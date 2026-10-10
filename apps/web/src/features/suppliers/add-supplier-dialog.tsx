import { useEffect, useId, useState, type FormEvent } from 'react';
import { useCreateSupplierMutation } from './use-suppliers';

type AddSupplierDialogProps = {
  onClose: () => void;
};

export function AddSupplierDialog({ onClose }: AddSupplierDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
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
      await createSupplier.mutateAsync({ name });
      onClose();
    } catch {
      // The mutation error is rendered below.
    }
  }

  const errorMessage = clientError
    ? clientError
    : createSupplier.isError
      ? createSupplier.error instanceof Error
        ? createSupplier.error.message
        : 'Could not add supplier'
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
