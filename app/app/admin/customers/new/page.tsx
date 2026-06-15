"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { useToast } from "@/components/admin/AdminUI";
import { CustomerForm, type CustomerDraft } from "@/components/admin/CustomerForm";
import { adminApi } from "@/lib/adminApi";

function NewCustomerInner() {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const initial: CustomerDraft = { phone: "", name: "", carPlate: "", emirate: "", locale: "en" };

  const create = async (d: CustomerDraft) => {
    setSaving(true);
    try {
      const u = await adminApi.createCustomer(d);
      toast("Customer created");
      router.push(`/admin/customers/${u.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      const human: Record<string, string> = {
        PHONE_TAKEN: "A customer with this phone already exists",
        PHONE_REQUIRED: "Enter a phone number",
      };
      toast(human[msg] ?? msg, "warn");
      setSaving(false);
    }
  };

  return (
    <div className="admin-split" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
      <CustomerForm initial={initial} mode="create" saving={saving}
                    onSubmit={create} onCancel={() => router.push("/admin/customers")} />
      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Quick note</div></div>
        <div className="admin-panel-body">
          <p className="admin-meta">
            Customers usually register themselves on their first order (by phone). Manual creation is
            for cases where the order is taken at the counter or over the phone.
          </p>
          <p className="admin-meta" style={{ marginTop: 10 }}>
            <strong>Phone</strong> is the primary identifier: the customer logs in with it and orders
            are tied to it. It must be unique.
          </p>
          <p className="admin-meta" style={{ marginTop: 10 }}>
            Name, car plate and emirate can be filled in later — they are prefilled at checkout.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NewCustomerPage() {
  return (
    <AdminShell title="New customer"
                crumbs={[{ label: "Customers", href: "/admin/customers" }, { label: "New" }]}>
      <NewCustomerInner />
    </AdminShell>
  );
}
