import { useRef, useState } from 'react';
import type { FormEvent, FocusEvent } from 'react';
import { ApiError } from '../../../lib/http';
import { useAuthentication, useCsrf } from './useAuthentication';
import {
  validateField,
  validateForm,
} from '../validation/authentication.validation';
import type {
  AuthField,
  AuthenticationMode,
  FieldErrors,
} from '../types/authentication';

function submissionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.res.code === 'INVALID_CREDENTIALS')
      return 'The email or password is incorrect.';
    if (error.res.code === 'SESSION_EXPIRED')
      return 'Your session expired. Please submit again with a fresh security token.';
    if (error.res.code === 'CSRF_INVALID')
      return 'Your security token expired. Please try again.';
    return error.res.message;
  }
  return 'Unable to connect. Check your connection and try again.';
}
export function useAuthenticationForm(mode: AuthenticationMode) {
  const signup = mode === 'sign-up';
  const csrf = useCsrf();
  const mutation = useAuthentication(mode);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string>();
  const submitting = useRef(false);
  const failureRef = useRef<HTMLParagraphElement>(null);
  function blur(event: FocusEvent<HTMLFormElement>) {
    if (!(event.target instanceof HTMLInputElement)) return;
    const field = event.target.name;
    if (!['email', 'name', 'password'].includes(field)) return;
    const error = validateField(field as AuthField, event.target.value, mode);
    setErrors((current) => ({ ...current, [field]: error }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      submitting.current ||
      mutation.isPending ||
      !csrf.data ||
      csrf.isFetching ||
      csrf.isError
    )
      return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const fieldErrors = validateForm(data, mode);
    // Use native email syntax checks in addition to the small validation functions.
    const emailInput = form.elements.namedItem('email') as HTMLInputElement;
    if (emailInput.validity.typeMismatch)
      fieldErrors.email = 'Enter a valid email address.';
    setErrors(fieldErrors);
    setFailure(undefined);
    const invalid = Object.keys(fieldErrors)[0];
    if (invalid) {
      (form.elements.namedItem(invalid) as HTMLInputElement).focus();
      return;
    }
    submitting.current = true;
    const input = {
      email: String(data.get('email')).trim().toLowerCase(),
      password: String(data.get('password')),
    };
    try {
      await mutation.mutateAsync(
        signup ? { ...input, name: String(data.get('name')).trim() } : input,
      );
      form.reset();
    } catch (error) {
      const serverErrors: FieldErrors = {};
      if (error instanceof ApiError) {
        for (const field of ['name', 'email', 'password'] as const) {
          const message = error.res.fieldErrors?.[field]?.[0];
          if (message) serverErrors[field] = message;
        }
      }
      setErrors(serverErrors);
      setFailure(submissionError(error));
      const first = Object.keys(serverErrors)[0];
      requestAnimationFrame(() => {
        if (first && form.isConnected)
          (form.elements.namedItem(first) as HTMLInputElement).focus();
        else failureRef.current?.focus();
      });
    } finally {
      submitting.current = false;
      mutation.reset();
    }
  }
  return { csrf, mutation, errors, failure, failureRef, blur, submit };
}
