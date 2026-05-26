/**
 * Email validation
 * @param value - Email string to validate
 * @returns Error message if invalid, empty string if valid
 */
export const validateEmail = (value: string): string => {
  if (!value.trim()) {
    return 'Email is required';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Please enter a valid email address';
  }
  return '';
};

/**
 * Password validation
 * @param value - Password string to validate
 * @returns Error message if invalid, empty string if valid
 */
export const validatePassword = (value: string): string => {
  if (!value.trim()) {
    return 'Password is required';
  }
  if (value.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return '';
};

/**
 * Form validation object
 */
export interface FormErrors {
  email: string;
  password: string;
}

/**
 * Validate entire login form
 * @param email - Email to validate
 * @param password - Password to validate
 * @returns Object with field errors
 */
export const validateLoginForm = (email: string, password: string): FormErrors => {
  return {
    email: validateEmail(email),
    password: validatePassword(password),
  };
};

/**
 * Check if form has any errors
 * @param errors - Form errors object
 * @returns True if form is valid
 */
export const isFormValid = (errors: FormErrors): boolean => {
  return !errors.email && !errors.password;
};
