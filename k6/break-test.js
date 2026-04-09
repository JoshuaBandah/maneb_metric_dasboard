import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = 'http://localhost:3000';
const METRIC_URL = 'http://localhost:3001';

const TOTAL_RECORDS = 4000;

const MAX_POLL_ATTEMPTS = 150;
const POLL_INTERVAL = 1;

const SUBMIT_MAX_RETRIES = 50;

// GENERATE STUDENT
function generateStudentData(studentNumber) {
  const startDate = new Date(2004, 0, 1);
  const targetDate = new Date(startDate);

  targetDate.setDate(startDate.getDate() + (studentNumber - 1));

  return {
    student_number: studentNumber.toString(),
    date_of_birth: targetDate.toISOString().split('T')[0],
  };
}

// SUBMIT JOB (WITH REAL ERROR REASONS)
function submitToQueue(studentNumber, dateOfBirth) {
  const url =
    `${BASE_URL}/grades/view-cached-results-que` +
    `?date_of_birth=${encodeURIComponent(dateOfBirth)}` +
    `&student_number=${encodeURIComponent(studentNumber)}`;

  let attempts = 0;
  let lastError = null;

  while (attempts < SUBMIT_MAX_RETRIES) {
    attempts++;

    const res = http.get(url, {
      timeout: '60s',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // NETWORK TIMEOUT
    if (res.status === 0) {
      lastError = 'network_timeout';
      sleep(0.2 * attempts);
      continue;
    }

    // SUCCESS PATH
    if (res.status === 202) {
      try {
        const body = JSON.parse(res.body);

        if (body.success && body.data?.jobId) {
          return {
            success: true,
            jobId: body.data.jobId,
            retries: attempts - 1,
          };
        }

        lastError = 'invalid_202_response';
      } catch (e) {
        lastError = 'invalid_json_202';
      }
    } else {
      // REAL HTTP ERROR CAPTURE
      lastError = `http_${res.status}`;
    }

    sleep(0.2 * attempts);
  }

  return {
    success: false,
    jobId: null,
    reason: lastError || 'submit_failed_unknown',
    retries: attempts,
  };
}

// POLL JOB RESULT (SMART FAILURE TRACKING)
function pollForResult(jobId) {
  const start = Date.now();
  let attempts = 0;
  let lastStatus = null;
  let lastError = null;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const res = http.get(
      `${BASE_URL}/grades/queue/status/${jobId}`,
      {
        timeout: '60s',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    attempts++;

    // NETWORK FAILURE
    if (res.status === 0) {
      lastError = 'poll_network_timeout';
      sleep(POLL_INTERVAL);
      continue;
    }

    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);

        lastStatus = body.status;

        // SUCCESS
        if (body.status === 'completed') {
          return {
            success: true,
            waitTime: Date.now() - start,
            attempts,
          };
        }

        // BACKEND FAILURE
        if (body.status === 'failed') {
          return {
            success: false,
            reason: body.result?.failedReason || 'backend_failed',
            attempts,
            lastStatus,
          };
        }
      } catch (e) {
        lastError = 'invalid_json_poll';
      }
    } else {
      lastError = `poll_http_${res.status}`;
    }

    sleep(POLL_INTERVAL);
  }

  return {
    success: false,
    reason: lastError || 'poll_timeout',
    lastStatus,
    attempts,
  };
}

// PUSH RESULT TO METRICS
function pushVUResult(result) {
  http.post(
    `${METRIC_URL}/k6/vu-result`,
    JSON.stringify(result),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: '30s',
    }
  );
}

// MAIN FLOW
function runFlow() {
  const studentNumber =
    Math.floor(Math.random() * TOTAL_RECORDS) + 1;

  const student = generateStudentData(studentNumber);

  // SUBMIT
  const submission = submitToQueue(
    student.student_number,
    student.date_of_birth
  );

  if (!submission.success) {
    pushVUResult({
      vu: __VU,
      stage: 'submit',
      success: false,
      reason: submission.reason,
      retries: submission.retries,
    });
    return;
  }

  // POLL
  const result = pollForResult(submission.jobId);

  pushVUResult({
    vu: __VU,
    stage: result.success ? 'completed' : 'polling',
    success: result.success,
    waitTime: result.waitTime || 0,
    submitRetries: submission.retries || 0,
    pollAttempts: result.attempts || 0,
    reason: result.reason || null,
  });
}

// LOAD TEST CONFIG
export const options = {
  scenarios: {
    queue_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 1000 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};

// EXECUTION
export default function () {
  runFlow();
  sleep(Math.random() * 0.2);
}

// TEARDOWN
export function teardown() {
  console.log('Clearing metrics...');

  http.post(`${METRIC_URL}/k6/clear`, null, {
    timeout: '30s',
  });
}