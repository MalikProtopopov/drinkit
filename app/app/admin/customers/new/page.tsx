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
      toast("Клиент создан");
      router.push(`/admin/customers/${u.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      const human: Record<string, string> = {
        PHONE_TAKEN: "Клиент с таким телефоном уже есть",
        PHONE_REQUIRED: "Укажите телефон",
      };
      toast(human[msg] ?? msg, "warn");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
      <CustomerForm initial={initial} mode="create" saving={saving}
                    onSubmit={create} onCancel={() => router.push("/admin/customers")} />
      <div className="admin-panel">
        <div className="admin-panel-head"><div className="admin-panel-title">Памятка</div></div>
        <div className="admin-panel-body">
          <p className="admin-meta">
            Обычно клиенты регистрируются сами при первом заказе (по телефону). Ручное создание —
            для случаев, когда заказ оформляется за стойкой или по звонку.
          </p>
          <p className="admin-meta" style={{ marginTop: 10 }}>
            <strong>Телефон</strong> — основной идентификатор: по нему клиент входит и к нему
            привязываются заказы. Должен быть уникальным.
          </p>
          <p className="admin-meta" style={{ marginTop: 10 }}>
            Имя, номер машины и эмират можно дозаполнить позже — они подставляются в оформление заказа.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NewCustomerPage() {
  return (
    <AdminShell title="Новый клиент"
                crumbs={[{ label: "Клиенты", href: "/admin/customers" }, { label: "Новый" }]}>
      <NewCustomerInner />
    </AdminShell>
  );
}
