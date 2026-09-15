import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { ReceiptEditButton } from "./edit-form";
import { encounterLabel } from "@/lib/utils";
import { formatNaira, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ receipt: string }>;
}) {
  await requireRole(["receptionist", "cashier", "admin"]);

  const { receipt } = await params;
  const supabase = await createClient();

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("*")
    .eq("receipt_number", receipt)
    .maybeSingle();

  if (paymentError || !payment) notFound();

  const { data: ledger } = await supabase
    .from("v_treatment_balance")
    .select("*")
    .eq("treatment_id", payment.treatment_id)
    .single();

  const fee = Number(ledger?.total_treatment_fee ?? 0);
  const paid = Number(ledger?.total_paid ?? 0);
  const balance = Math.max(0, fee - paid);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between gap-2 no-print">
        <Link href="/receptionist" className="btn btn-ghost btn-sm">
          &larr; Back to Intake &amp; Billing
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
          <ReceiptEditButton
            paymentId={payment.id}
            amountPaid={Number(payment.amount_paid)}
            paymentMethod={payment.payment_method}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="receipt">
          <div className="receipt-center">
            <div className="text-lg font-bold">HOMECARE CLINIC</div>
            <div>Osogbo, Osun State, Nigeria</div>
            <div>Tel: 0800 000 000 | homecareclinic.ng</div>
          </div>

          <div className="receipt-divider" />
          <div className="receipt-row">
            <span>Receipt No.</span>
            <span className="font-mono font-semibold">{payment.receipt_number}</span>
          </div>
          <div className="receipt-row">
            <span>Date / Time</span>
            <span>{formatDateTime(payment.created_at)}</span>
          </div>
          <div className="receipt-row">
            <span>Payment Method</span>
            <span className="uppercase">{payment.payment_method}</span>
          </div>

          <div className="receipt-divider" />
          <div className="receipt-row">
            <span>Patient ID</span>
            <span className="font-mono">{ledger?.patient_code ?? "-"}</span>
          </div>
          <div className="receipt-row">
            <span>Patient Name</span>
            <span>{ledger?.patient_name ?? "-"}</span>
          </div>
          <div className="receipt-row">
            <span>Treatment</span>
            <span>{ledger ? encounterLabel(ledger.encounter_type) : "-"}</span>
          </div>
          {ledger?.category && ledger.category !== "-" && ledger.category !== "" && (
            <div className="receipt-row">
              <span>Category</span>
              <span>{ledger.category}</span>
            </div>
          )}

          <div className="receipt-divider" />
          <div className="receipt-row">
            <span>Treatment Fee</span>
            <span>{formatNaira(fee)}</span>
          </div>
          <div className="receipt-row">
            <span>Amount Received</span>
            <span className="font-bold">{formatNaira(payment.amount_paid)}</span>
          </div>
          <div className="receipt-row">
            <span>Total Paid So Far</span>
            <span>{formatNaira(paid)}</span>
          </div>
          <div className="receipt-row">
            <span>Balance</span>
            <span className={balance > 0 ? "font-bold" : ""}>{formatNaira(balance)}</span>
          </div>

          <div className="receipt-divider" />
          <div className="receipt-center">
            <div>THANK YOU. GET WELL SOON.</div>
            <div className="receipt-tiny">
              Valid only with stamped &amp; signed seal at the cash desk.
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 no-print">
        Click Print and use 80mm thermal paper (or 58mm if your printer is set to that width).
      </p>
    </div>
  );
}