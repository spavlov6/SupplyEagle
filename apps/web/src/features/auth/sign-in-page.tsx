import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSignInMutation } from './use-auth';

export function SignInPage() {
  const navigate = useNavigate();
  const signIn = useSignInMutation();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await signIn.mutateAsync({
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
      <h1>Sign in</h1>
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
            autoComplete="current-password"
            minLength={8}
            required
          />
        </label>
        {signIn.isError ? (
          <p className="form-error">
            {signIn.error instanceof Error
              ? signIn.error.message
              : 'Sign in failed'}
          </p>
        ) : null}
        <button type="submit" disabled={signIn.isPending}>
          {signIn.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth-switch">
        Need an account? <Link to="/sign-up">Sign up</Link>
      </p>
    </>
  );
}
