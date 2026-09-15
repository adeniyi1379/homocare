"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { updatePayment } from "../../actions";
import { Modal } from "@/components/modal";
import { Field, inputClass, selectClass } from "@/components/ui";
import { FormError, SubmitButton } from "@/components/form-ui";

export function ReceiptEditButton({
  paymentId,
  amountPaid,
  paymentMethod,
}: {
  paymentId: string;
  amountPaid: number;
  paymentMethod: string;
}) {
  const [open, setOpen] = useState(false);
  const submitted = useRef(false);
  const [state, action] = useActionState(updatePayment, undefined);

  useEffect(() => {
    if (submitted.current && !state?.error) {
      setOpen(false);
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print btn btn-ghost"
      >
        Edit Receipt
      </button>

      <Modal open={open} title="Edit Receipt" onClose={() => setOpen(false)}>
        <form
          action={(fd) => {
            submitted.current = true;
            fd.set("payment_id", paymentId);
            action(fd);
          }}
          className="space-y-4"
        >
          <FormError message={state?.error} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (\u20A6)">
              <input
                name="amount_paid"
                type="number"
                step="0.01"
                min="0.01"
                required
                className={inputClass}
                defaultValue={amountPaid}
              />
            </Field>
            <Field label="Method">
              <select
                name="payment_method"
                className={selectClass}
                defaultValue={paymentMethod}
              >
                <option value="cash">Cash</option>
                <option value="pos_terminal">POS Terminal</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </Field>
          </div>
          <p className="text-xs text-slate-400">
            Corrections are logged in the audit trail. The treatment balance and patient status
            update automatically.
          </p>
          <SubmitButton pendingLabel="Saving...">
            Save Changes
          </SubmitButton>
        </form>
      </Modal>
    </>
  );
}