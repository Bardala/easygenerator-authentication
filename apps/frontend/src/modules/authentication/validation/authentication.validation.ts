import type {
  AuthField,
  AuthenticationMode,
  FieldErrors,
} from '../types/authentication';
const length = (value: string) => Array.from(value).length;
export function passwordChecks(value: string) {
  return [
    {
      label: '8–128 characters',
      valid: length(value) >= 8 && length(value) <= 128,
    },
    { label: 'At least one letter', valid: /\p{L}/u.test(value) },
    { label: 'At least one number', valid: /[0-9]/.test(value) },
    {
      label: 'At least one special character',
      valid: /[\p{P}\p{S}]/u.test(value),
    },
  ];
}
export function validateField(
  field: AuthField,
  value: string,
  mode: AuthenticationMode,
): string | undefined {
  if (field === 'email') {
    const email = value.trim();
    if (!email) return 'Enter your email address.';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return 'Enter a valid email address (up to 254 characters).';
  }
  if (
    field === 'name' &&
    (length(value.trim()) < 3 || length(value.trim()) > 100)
  )
    return 'Enter a name with 3–100 characters.';
  if (field === 'password') {
    if (!value) return 'Enter your password.';
    if (
      mode === 'sign-up' &&
      passwordChecks(value).some((check) => !check.valid)
    )
      return 'Use 8–128 characters with a letter, number, and special character.';
    if (mode === 'sign-in' && length(value) > 128)
      return 'Use at most 128 characters.';
  }
  return undefined;
}
export function validateForm(
  data: FormData,
  mode: AuthenticationMode,
): FieldErrors {
  const errors: FieldErrors = {};
  const fields: AuthField[] =
    mode === 'sign-up' ? ['name', 'email', 'password'] : ['email', 'password'];
  for (const field of fields) {
    const error = validateField(field, String(data.get(field) ?? ''), mode);
    if (error) errors[field] = error;
  }
  return errors;
}
