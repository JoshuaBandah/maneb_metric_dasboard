import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = 'http://172.18.16.12:3000';
const TOTAL_RECORDS = 4000;

const MAX_POLL_ATTEMPTS = 200;
const POLL_INTERVAL = 1;
const SUBMIT_MAX_RETRIES = 50;

// Generates:
// Student 1  -> 2004-01-01
// Student 2  -> 2004-01-02
// Student 3  -> 2004-01-03
function generateStudentData(studentNumber) {
  const startDate = new Date(2004, 0, 1);

  const targetDate = new Date(startDate);
  targetDate.setDate(startDate.getDate() + (studentNumber - 1));

  return {
    student_number: studentNumber.toString(),
    date_of_birth: targetDate.toISOString().split('T')[0],
  };
}

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
    });

    if (res.status === 202) {
      try {
        const body = JSON.parse(res.body);

        if (body.success && body.data?.jobId) {
          return {
            success: true,
            jobId: body.data.jobId,
          };
        }
      } catch (e) {
        lastError = 'invalid_json';
      }
    } else {
      lastError = `http_${res.status}`;
    }

    // Progressive retry backoff
    sleep(0.2 * attempts);
  }

  return {
    success: false,
    reason: lastError || 'submit_failed',
  };
}

function pollForResult(jobId) {
  let attempts = 0;

  while (attempts < MAX_POLL_ATTEMPTS) {
    const res = http.get(
      `${BASE_URL}/grades/queue/status/${jobId}`,
      {
        timeout: '60s',
      }
    );

    attempts++;

    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);

        if (body.status === 'completed') {
          return {
            success: true,
          };
        }

        if (body.status === 'failed') {
          return {
            success: false,
            reason: 'backend_failed',
          };
        }
      } catch (e) {}
    }

    sleep(POLL_INTERVAL);
  }

  return {
    success: false,
    reason: 'timeout',
  };
}

function runFlow() {
  // Sequential deterministic student generation
  // Loops back after TOTAL_RECORDS
  const studentNumber = (__ITER % TOTAL_RECORDS) + 1;

  const student = generateStudentData(studentNumber);

  const submission = submitToQueue(
    student.student_number,
    student.date_of_birth
  );

  if (!submission.success) {
    return;
  }

  pollForResult(submission.jobId);
}

export const options = {
  scenarios: {
    queue_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '15m', target: 20000 },
        { duration: '30s', target: 0 },
      ],
    },
  },
};

export default function () {
  runFlow();

  // Deterministic pacing
  sleep(0.2);
}