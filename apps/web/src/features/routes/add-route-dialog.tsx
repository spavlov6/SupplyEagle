import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ShippingMode } from '@supplyeagle/types';
import { useSuppliersQuery } from '../suppliers/use-suppliers';
import { useCreateRouteMutation } from './use-routes';

type AddRouteDialogProps = {
  onClose: () => void;
};

export function AddRouteDialog({ onClose }: AddRouteDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const navigate = useNavigate();
  const suppliersQuery = useSuppliersQuery();
  const createRoute = useCreateRouteMutation();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [clientError, setClientError] = useState<string | null>(null);
  const suppliers = suppliersQuery.data?.suppliers ?? [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function toggleSupplier(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const origin = String(form.get('origin') ?? '').trim();
    const destination = String(form.get('destination') ?? '').trim();
    const mode = form.get('mode') === 'sea' ? 'sea' : 'air';

    if (!origin || !destination) {
      setClientError('Origin and destination are required.');
      return;
    }

    if (selected.size === 0) {
      setClientError('Select at least one supplier.');
      return;
    }

    setClientError(null);

    try {
      const created = await createRoute.mutateAsync({
        origin,
        destination,
        mode: mode satisfies ShippingMode,
        supplierIds: [...selected],
      });
      navigate(`/routes/${created.id}`);
      onClose();
    } catch {
      // The mutation error is rendered below.
    }
  }

  const errorMessage = clientError
    ? clientError
    : createRoute.isError
      ? readableError(createRoute.error, 'Could not add this route. Try again.')
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
        <h2 id={titleId}>Add route</h2>
        <p id={descriptionId} className="dialog-copy">
          Air or sea cargo between two places, linked to suppliers you already
          monitor.
        </p>
        {suppliersQuery.isPending ? (
          <p className="detail">Loading suppliers…</p>
        ) : null}
        {suppliersQuery.isError ? (
          <p className="form-error">Could not load suppliers.</p>
        ) : null}
        {suppliersQuery.data && suppliers.length === 0 ? (
          <p className="dialog-copy">
            Add a supplier before creating a route.{' '}
            <Link className="text-link" to="/suppliers" onClick={onClose}>
              Go to Suppliers
            </Link>
          </p>
        ) : null}
        {suppliers.length > 0 ? (
          <form
            className="auth-form"
            onSubmit={(event) => void onSubmit(event)}
          >
            <label className="field">
              <span>Origin</span>
              <input
                name="origin"
                type="text"
                maxLength={200}
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span>Destination</span>
              <input name="destination" type="text" maxLength={200} required />
            </label>
            <fieldset className="option-field">
              <legend>Suppliers</legend>
              <div
                className="supplier-chips"
                role="group"
                aria-label="Suppliers"
              >
                {suppliers.map((supplier) => (
                  <button
                    key={supplier.id}
                    type="button"
                    className="supplier-chip"
                    aria-pressed={selected.has(supplier.id)}
                    onClick={() => toggleSupplier(supplier.id)}
                  >
                    {supplier.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="option-field">
              <legend>Mode</legend>
              <div className="mode-options">
                <label className="mode-choice">
                  <input type="radio" name="mode" value="air" defaultChecked />
                  Air
                </label>
                <label className="mode-choice">
                  <input type="radio" name="mode" value="sea" />
                  Sea
                </label>
              </div>
            </fieldset>
            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
            <div className="dialog-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" disabled={createRoute.isPending}>
                {createRoute.isPending ? 'Adding…' : 'Create route'}
              </button>
            </div>
          </form>
        ) : null}
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
