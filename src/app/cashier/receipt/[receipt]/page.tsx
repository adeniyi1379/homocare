import { notFound } from "next/navigation";
import Link from "next/link";
import type { CSSProperties } from "react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { ReceiptEditButton } from "./edit-form";
import { formatNaira, formatDateTime } from "@/lib/utils";
import type { Role } from "@/lib/roles";

export const dynamic = "force-dynamic";

type ReceiptDocument = {
  receipt_number: string;
  payment_id: string;
  amount_paid: number;
  payment_method: string;
  paid_at: string;
  patient_code: string;
  patient_name: string;
  encounter_type: string;
  treatment_id: string;
  total_treatment_fee: number;
  total_paid: number;
  balance_remaining: number;
  items: {
    category: string;
    item_name: string;
    quantity: number;
    sell_price_snapshot: number;
    line_total: number;
  }[];
};

type DocumentKind = "receipt" | "invoice" | "blank";

const DOCS: { id: DocumentKind; label: string }[] = [
  { id: "receipt", label: "Receipt" },
  { id: "invoice", label: "Invoice" },
  { id: "blank", label: "Blank Form" },
];

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  transfer: "Bank Transfer",
  card: "Card",
  pos: "POS",
};

const RECEIPT_STYLE: CSSProperties = {
  width: "80mm",
  maxWidth: "80mm",
  padding: "2mm 3mm",
  fontFamily: '"JetBrains Mono", "Courier New", monospace',
  fontSize: "11px",
  lineHeight: "1.5",
  color: "#000",
  boxSizing: "border-box",
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: "0.5mm 0", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ padding: "0.5mm 0", textAlign: "right", paddingLeft: "2mm" }}>{value}</td>
    </tr>
  );
}

function DashedLine() {
  return <div style={{ borderTop: "1px dashed #000", margin: "1mm 0", height: 0 }} />;
}

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ receipt: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const current = await requireRole(["receptionist", "cashier", "dispenser", "nurse", "admin"]);
  const isFinancial = ["receptionist", "cashier", "admin"].includes(current.profile.role);

  const { receipt } = await params;
  const { doc: docParam } = await searchParams;
  const kind: DocumentKind = DOCS.some((d) => d.id === docParam) ? (docParam as DocumentKind) : "receipt";

  const supabase = await createClient();

  const { data: doc, error } = await supabase.rpc("get_receipt_document", {
    p_receipt: receipt,
  });

  if (error || !doc) notFound();
  const d = doc as unknown as ReceiptDocument;

  const lines = d.items ?? [];
  const subtotal = lines.reduce((s, l) => s + Number(l.line_total ?? 0), 0);
  const blankForm = kind === "blank";
  const showItems = kind !== "receipt";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between gap-2 no-print">
        <Link
          href={isFinancial ? "/cashier" : "/dispense"}
          className="btn btn-ghost btn-sm"
        >
          &larr; Back
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton label={`Print ${kind === "blank" ? "Blank Form" : kind === "invoice" ? "Invoice" : "Receipt"}`} />
          {isFinancial && (
            <ReceiptEditButton
              paymentId={d.payment_id}
              amountPaid={Number(d.amount_paid ?? 0)}
              paymentMethod={d.payment_method}
            />
          )}
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 no-print">
        {DOCS.map((doc) => (
          <Link
            key={doc.id}
            href={`/cashier/receipt/${receipt}?doc=${doc.id === "receipt" ? "" : doc.id}`}
            className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-semibold transition-colors ${
              kind === doc.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {doc.label}
          </Link>
        ))}
      </div>

      <div className="print-area rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div
          className="mx-auto bg-white text-black"
          style={RECEIPT_STYLE}
        >
          {/* Hospital header */}
          <div style={{ textAlign: "center", marginBottom: "2mm" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              HOMOCARE CLINIC
            </div>
            <div style={{ fontSize: "10px", marginTop: "1px" }}>Osogbo, Osun State, Nigeria</div>
            <div style={{ fontSize: "10px" }}>Tel: 0800 000 000 | homocareclinic.ng</div>
          </div>

          <DashedLine />

          <div style={{ textAlign: "center", fontWeight: 700, fontSize: "12px", padding: "1mm 0" }}>
            {kind === "invoice" ? "INVOICE" : "PAYMENT RECEIPT"}
          </div>

          <DashedLine />

          {/* Receipt meta */}
          <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
            <tbody>
              <MetaRow label="Receipt No:" value={d.receipt_number} />
              <MetaRow label="Date:" value={formatDateTime(d.paid_at)} />
              <MetaRow label="Patient ID:" value={d.patient_code ?? "-"} />
              <MetaRow label="Patient:" value={d.patient_name ?? "-"} />
              <MetaRow label="Method:" value={METHOD_LABELS[d.payment_method] || d.payment_method} />
            </tbody>
          </table>

          {showItems ? (
            <>
              <DashedLine />

              {/* Items header */}
              <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px dashed #000" }}>
                    <th style={{ textAlign: "left", padding: "1mm 0", fontWeight: 700 }}>Item</th>
                    <th style={{ textAlign: "center", padding: "1mm 0", fontWeight: 700, width: "8mm" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "1mm 0", fontWeight: 700, width: "22mm" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {kind === "blank" ? (
                    Array.from({ length: 10 }).map((_, idx) => (
                      <tr key={`blank-${idx}`} style={{ verticalAlign: "top" }}>
                        <td style={{ padding: "2.2mm 0" }}>&nbsp;</td>
                        <td style={{ padding: "2.2mm 0", textAlign: "center" }}>&nbsp;</td>
                        <td style={{ padding: "2.2mm 0", textAlign: "right" }}>&nbsp;</td>
                      </tr>
                    ))
                  ) : lines.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: "1mm 0", textAlign: "center", color: "#555" }}>
                        No dispensed items.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l, idx) => (
                      <tr key={`${l.category}-${l.item_name}-${idx}`} style={{ verticalAlign: "top" }}>
                        <td style={{ padding: "1mm 0" }}>
                          <div style={{ fontWeight: 600 }}>{l.item_name}</div>
                          <div style={{ fontSize: "9px", color: "#333" }}>
                            {formatNaira(l.sell_price_snapshot)} x {l.quantity}
                          </div>
                        </td>
                        <td style={{ padding: "1mm 0", textAlign: "center" }}>{l.quantity}</td>
                        <td style={{ padding: "1mm 0", textAlign: "right", fontWeight: 600 }}>
                          {formatNaira(l.line_total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          ) : (
            <>
              <DashedLine />
              <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                <tbody>
                  <MetaRow label="Amount Paid:" value={formatNaira(d.amount_paid)} />
                  <MetaRow label="Total Paid:" value={formatNaira(d.total_paid)} />
                  <MetaRow label="Balance:" value={formatNaira(d.balance_remaining)} />
                </tbody>
              </table>
            </>
          )}

          <DashedLine />

          {/* Totals */}
          <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
            <tbody>
              {showItems && !blankForm && (
                <tr>
                  <td style={{ padding: "0.5mm 0" }}>Subtotal:</td>
                  <td style={{ padding: "0.5mm 0", textAlign: "right" }}>{formatNaira(subtotal)}</td>
                </tr>
              )}
              <tr style={{ fontWeight: 700, fontSize: "12px" }}>
                <td style={{ padding: "1mm 0", borderTop: "1px solid #000" }}>GRAND TOTAL:</td>
                <td style={{ padding: "1mm 0", textAlign: "right", borderTop: "1px solid #000" }}>
                  {blankForm ? "" : formatNaira(d.total_treatment_fee)}
                </td>
              </tr>
            </tbody>
          </table>

          {blankForm && (
            <>
              <DashedLine />
            </>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", fontSize: "10px", marginTop: "1mm" }}>
            <div style={{ fontWeight: 600 }}>Thank you for choosing Homocare Clinic.</div>
          </div>

          {/* Cut line indicator */}
          <div
            style={{
              textAlign: "center",
              marginTop: "2mm",
              fontSize: "9px",
              color: "#999",
              letterSpacing: "2px",
            }}
          >
            - - - - - - - - - - - - - - -
          </div>
        </div>
      </div>
    </div>
  );
}
