import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useCreateSupplierMutation } from './use-suppliers';

type AddSupplierDialogProps = {
  onClose: () => void;
};

export function AddSupplierDialog({ onClose }: AddSupplierDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const navigate = useNavigate();
  const createSupplier = useCreateSupplierMutation();
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();

    if (!name) {
      setClientError('Name is required.');
      return;
    }

    setClientError(null);

    try {
      const created = await createSupplier.mutateAsync({ name });
      navigate(`/suppliers/${created.id}`);
      onClose();
    } catch {
      // The mutation error is rendered below.
    }
  }

  const errorMessage = clientError
    ? clientError
    : createSupplier.isError
      ? readableError(createSupplier.error, 'Could not add this supplier. Try again.')
      : null;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>Add supplier</h2>
        <p id={descriptionId} className="dialog-copy">
          A name is enough — the rest is filled in when research runs.
        </p>
        <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
          <label className="field">
            <span>Supplier name</span>
            <input
              name="name"
              type="text"
              autoComplete="organization"
              maxLength={200}
              required
              autoFocus
            />
          </label>
          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          <div className="dialog-actions">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" disabled={createSupplier.isPending}>
              {createSupplier.isPending ? 'Adding…' : 'Add supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function readableError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (
    message.length === 0 ||
    message.length > 160 ||
    message.startsWith('{') ||
    message.includes('request_id')
  ) {
    return fallback;
  }

  return message;
}
