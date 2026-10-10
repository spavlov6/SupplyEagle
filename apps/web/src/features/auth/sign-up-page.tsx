import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSignUpMutation } from './use-auth';

export function SignUpPage() {
  const navigate = useNavigate();
  const signUp = useSignUpMutation();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await signUp.mutateAsync({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      });
      void navigate('/');
    } catch {
      // The mutation error is rendered below.
    }
  }

  return (
    <>
      <h1>Sign up</h1>
      <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {signUp.isError ? (
          <p className="form-error">
            {signUp.error instanceof Error
              ? signUp.error.message
              : 'Sign up failed'}
          </p>
        ) : null}
        <button type="submit" disabled={signUp.isPending}>
          {signUp.isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/sign-in">Sign in</Link>
      </p>
    </>
  );
}
