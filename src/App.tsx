import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  calculateInvoiceTotals,
  createId,
  createSeedData,
  findCustomer,
  findVehicle,
  formatAed,
  getCustomerVehicleLabel,
  getDashboardStats,
  getLowStockItems,
  isWorkshopData,
  STORAGE_KEY
} from "./domain/workshop";
import type {
  AppointmentStatus,
  Customer,
  InventoryCategory,
  JobCard,
  JobStatus,
  WorkshopData
} from "./domain/workshop";

type Tab = "dashboard" | "customers" | "jobs" | "invoices" | "inventory" | "appointments" | "reports" | "settings";

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "🏁" },
  { id: "customers", label: "Customers & Vehicles", icon: "🚗" },
  { id: "jobs", label: "Job Cards", icon: "🔧" },
  { id: "invoices", label: "Invoices", icon: "🧾" },
  { id: "inventory", label: "Inventory", icon: "📦" },
  { id: "appointments", label: "Appointments", icon: "📅" },
  { id: "reports", label: "Reports", icon: "📈" },
  { id: "settings", label: "UAE Settings", icon: "🇦🇪" }
];

const statusOptions: JobStatus[] = ["Booked", "In Progress", "Waiting Approval", "Ready", "Invoiced"];
const appointmentStatusOptions: AppointmentStatus[] = ["Requested", "Confirmed", "Completed", "Cancelled"];
const categoryOptions: InventoryCategory[] = ["part", "service", "tire", "consumable"];
const emirates = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"];

function loadInitialData(): WorkshopData {
  const fallback = createSeedData();
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return fallback;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return isWorkshopData(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateInput(value: string): string {
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? todayIso();
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<WorkshopData>(loadInitialData);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(() => data.jobs[0]?.id ?? "");
  const [importMessage, setImportMessage] = useState("");
  // On the desktop the SQLite database is the source of truth. We must finish
  // loading it before persisting, otherwise the seeded initial state would
  // overwrite the saved database on startup.
  const [hydrated, setHydrated] = useState(() => !window.desktopDB);

  useEffect(() => {
    const desktopDB = window.desktopDB;
    if (!desktopDB) {
      return;
    }

    let active = true;
    desktopDB
      .load()
      .then((stored) => {
        if (!active) {
          return;
        }
        if (stored && isWorkshopData(stored)) {
          setData(stored);
          setSelectedInvoiceId(stored.jobs[0]?.id ?? "");
        }
        setHydrated(true);
      })
      .catch(() => {
        if (active) {
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (window.desktopDB) {
      void window.desktopDB.save(data);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, hydrated]);

  const today = todayIso();
  const stats = useMemo(() => getDashboardStats(data, today), [data, today]);
  const lowStockItems = useMemo(() => getLowStockItems(data.inventory), [data.inventory]);
  const selectedInvoice = data.jobs.find((job) => job.id === selectedInvoiceId) ?? data.jobs[0];

  function resetDemoData() {
    const seed = createSeedData();
    setData(seed);
    setSelectedInvoiceId(seed.jobs[0]?.id ?? "");
    setImportMessage("Demo workshop data restored.");
  }

  function downloadBackup() {
    const payload = JSON.stringify(data, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `jb7-workshop-backup-${today}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    if (!isWorkshopData(parsed)) {
      setImportMessage("Backup rejected: file does not match the JB7 workshop format.");
      return;
    }

    setData(parsed);
    setSelectedInvoiceId(parsed.jobs[0]?.id ?? "");
    setImportMessage(`Imported ${parsed.jobs.length} jobs and ${parsed.customers.length} customers.`);
    event.target.value = "";
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">JB7</span>
          <div>
            <strong>{data.settings.name}</strong>
            <small>Offline UAE Workshop</small>
          </div>
        </div>

        <nav>
          {tabs.map((tab) => (
            <button
              className={activeTab === tab.id ? "nav-button active" : "nav-button"}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="offline-card">
          <strong>Standalone mode</strong>
          <p>No subscription, no cloud login, no internet required. Data stays on this Windows device unless exported.</p>
          <button onClick={downloadBackup} type="button">Export backup</button>
          <label className="import-label">
            Import backup
            <input accept="application/json" onChange={(event) => void importBackup(event)} type="file" />
          </label>
          {importMessage ? <small>{importMessage}</small> : null}
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">AED • 5% VAT • TRN ready • English / Arabic workshop-ready layout</p>
            <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <span className="sync-pill">Offline data saved locally</span>
            <button onClick={resetDemoData} type="button">Restore demo data</button>
          </div>
        </header>

        {activeTab === "dashboard" ? <Dashboard data={data} lowStockItems={lowStockItems} stats={stats} today={today} /> : null}
        {activeTab === "customers" ? <CustomersPanel data={data} setData={setData} /> : null}
        {activeTab === "jobs" ? <JobsPanel data={data} setData={setData} /> : null}
        {activeTab === "invoices" ? (
          <InvoicesPanel
            data={data}
            selectedInvoice={selectedInvoice}
            selectedInvoiceId={selectedInvoiceId}
            setData={setData}
            setSelectedInvoiceId={setSelectedInvoiceId}
          />
        ) : null}
        {activeTab === "inventory" ? <InventoryPanel data={data} setData={setData} /> : null}
        {activeTab === "appointments" ? <AppointmentsPanel data={data} setData={setData} /> : null}
        {activeTab === "reports" ? <ReportsPanel data={data} /> : null}
        {activeTab === "settings" ? <SettingsPanel data={data} setData={setData} /> : null}
      </main>
    </div>
  );
}

function Dashboard({
  data,
  lowStockItems,
  stats,
  today
}: {
  data: WorkshopData;
  lowStockItems: ReturnType<typeof getLowStockItems>;
  stats: ReturnType<typeof getDashboardStats>;
  today: string;
}) {
  const activeJobs = data.jobs.filter((job) => job.status !== "Invoiced");

  return (
    <section className="panel-grid">
      <div className="kpi-card accent">
        <small>Active job cards</small>
        <strong>{stats.activeJobs}</strong>
        <span>{stats.todaysAppointments} appointments today</span>
      </div>
      <div className="kpi-card">
        <small>Monthly invoiced revenue</small>
        <strong>{formatAed(stats.monthlyRevenue)}</strong>
        <span>Based on completed invoices</span>
      </div>
      <div className="kpi-card">
        <small>Outstanding balance</small>
        <strong>{formatAed(stats.outstandingBalance)}</strong>
        <span>Customer payments pending</span>
      </div>
      <div className="kpi-card warning">
        <small>Low stock alerts</small>
        <strong>{stats.lowStockCount}</strong>
        <span>Parts at reorder level</span>
      </div>

      <div className="panel span-2">
        <div className="panel-title">
          <h2>Workshop floor</h2>
          <span>{today}</span>
        </div>
        <div className="job-board">
          {activeJobs.map((job) => (
            <article className="job-card" key={job.id}>
              <div>
                <strong>{job.jobNumber}</strong>
                <small>{job.status}</small>
              </div>
              <p>{getCustomerVehicleLabel(data, job)}</p>
              <span>Technician: {job.technician}</span>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Reorder list</h2>
          <span>{lowStockItems.length} alerts</span>
        </div>
        <ul className="compact-list">
          {lowStockItems.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.stock} left • reorder at {item.reorderLevel}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CustomersPanel({ data, setData }: { data: WorkshopData; setData: (updater: (data: WorkshopData) => WorkshopData) => void }) {
  const [customerDraft, setCustomerDraft] = useState({ name: "", phone: "+971 ", email: "", emirate: "Dubai" });
  const [vehicleDraft, setVehicleDraft] = useState({
    customerId: data.customers[0]?.id ?? "",
    plate: "",
    make: "",
    model: "",
    year: "2024",
    vin: "",
    odometerKm: "0",
    nextServiceKm: "10000"
  });

  function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerDraft.name.trim()) {
      return;
    }

    const customer: Customer = {
      id: createId("cust"),
      name: customerDraft.name.trim(),
      phone: customerDraft.phone.trim(),
      email: customerDraft.email.trim(),
      emirate: customerDraft.emirate
    };

    setData((current) => ({ ...current, customers: [customer, ...current.customers] }));
    setCustomerDraft({ name: "", phone: "+971 ", email: "", emirate: "Dubai" });
  }

  function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehicleDraft.customerId || !vehicleDraft.plate.trim()) {
      return;
    }

    setData((current) => ({
      ...current,
      vehicles: [
        {
          id: createId("veh"),
          customerId: vehicleDraft.customerId,
          plate: vehicleDraft.plate.trim().toUpperCase(),
          make: vehicleDraft.make.trim(),
          model: vehicleDraft.model.trim(),
          year: Number(vehicleDraft.year),
          vin: vehicleDraft.vin.trim().toUpperCase(),
          odometerKm: Number(vehicleDraft.odometerKm),
          nextServiceKm: Number(vehicleDraft.nextServiceKm)
        },
        ...current.vehicles
      ]
    }));
    setVehicleDraft((draft) => ({ ...draft, plate: "", make: "", model: "", vin: "" }));
  }

  return (
    <section className="panel-grid">
      <form className="panel form-card" onSubmit={addCustomer}>
        <h2>Add customer</h2>
        <input onChange={(event) => setCustomerDraft({ ...customerDraft, name: event.target.value })} placeholder="Customer / fleet name" value={customerDraft.name} />
        <input onChange={(event) => setCustomerDraft({ ...customerDraft, phone: event.target.value })} placeholder="UAE mobile" value={customerDraft.phone} />
        <input onChange={(event) => setCustomerDraft({ ...customerDraft, email: event.target.value })} placeholder="Email" value={customerDraft.email} />
        <select onChange={(event) => setCustomerDraft({ ...customerDraft, emirate: event.target.value })} value={customerDraft.emirate}>
          {emirates.map((emirate) => <option key={emirate}>{emirate}</option>)}
        </select>
        <button type="submit">Save customer</button>
      </form>

      <form className="panel form-card" onSubmit={addVehicle}>
        <h2>Add vehicle</h2>
        <select onChange={(event) => setVehicleDraft({ ...vehicleDraft, customerId: event.target.value })} value={vehicleDraft.customerId}>
          {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
        <input onChange={(event) => setVehicleDraft({ ...vehicleDraft, plate: event.target.value })} placeholder="Plate e.g. D 48291" value={vehicleDraft.plate} />
        <div className="two-col">
          <input onChange={(event) => setVehicleDraft({ ...vehicleDraft, make: event.target.value })} placeholder="Make" value={vehicleDraft.make} />
          <input onChange={(event) => setVehicleDraft({ ...vehicleDraft, model: event.target.value })} placeholder="Model" value={vehicleDraft.model} />
        </div>
        <div className="two-col">
          <input onChange={(event) => setVehicleDraft({ ...vehicleDraft, year: event.target.value })} type="number" value={vehicleDraft.year} />
          <input onChange={(event) => setVehicleDraft({ ...vehicleDraft, odometerKm: event.target.value })} type="number" value={vehicleDraft.odometerKm} />
        </div>
        <input onChange={(event) => setVehicleDraft({ ...vehicleDraft, vin: event.target.value })} placeholder="VIN" value={vehicleDraft.vin} />
        <button type="submit">Save vehicle</button>
      </form>

      <div className="panel span-2">
        <div className="panel-title">
          <h2>Customer garage</h2>
          <span>{data.customers.length} customers • {data.vehicles.length} vehicles</span>
        </div>
        <div className="table">
          <div className="table-row table-head">
            <span>Customer</span>
            <span>Contact</span>
            <span>Vehicles</span>
            <span>Emirate</span>
          </div>
          {data.customers.map((customer) => (
            <div className="table-row" key={customer.id}>
              <span>{customer.name}</span>
              <span>{customer.phone}<small>{customer.email}</small></span>
              <span>{data.vehicles.filter((vehicle) => vehicle.customerId === customer.id).map((vehicle) => vehicle.plate).join(", ") || "No vehicle"}</span>
              <span>{customer.emirate}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function JobsPanel({ data, setData }: { data: WorkshopData; setData: (updater: (data: WorkshopData) => WorkshopData) => void }) {
  const firstCustomerId = data.customers[0]?.id ?? "";
  const firstVehicleId = data.vehicles.find((vehicle) => vehicle.customerId === firstCustomerId)?.id ?? "";
  const firstItemId = data.inventory[0]?.id ?? "";
  const [draft, setDraft] = useState({
    customerId: firstCustomerId,
    vehicleId: firstVehicleId,
    inventoryItemId: firstItemId,
    technician: "",
    complaint: "",
    dueAt: todayIso()
  });

  const customerVehicles = data.vehicles.filter((vehicle) => vehicle.customerId === draft.customerId);

  function addJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const inventoryItem = data.inventory.find((item) => item.id === draft.inventoryItemId);
    const vehicleId = draft.vehicleId || customerVehicles[0]?.id;
    if (!draft.customerId || !vehicleId || !inventoryItem) {
      return;
    }

    const nextJobNumber = `${data.settings.invoicePrefix}-${1000 + data.jobs.length + 1}`;
    const job: JobCard = {
      id: createId("job"),
      jobNumber: nextJobNumber,
      customerId: draft.customerId,
      vehicleId,
      status: "Booked",
      technician: draft.technician.trim() || "Unassigned",
      openedAt: todayIso(),
      dueAt: draft.dueAt,
      complaint: draft.complaint.trim(),
      inspection: "Initial inspection pending.",
      recommendations: "Awaiting technician recommendations.",
      lines: [
        {
          id: createId("line"),
          type: inventoryItem.category,
          itemName: inventoryItem.name,
          quantity: 1,
          unitPrice: inventoryItem.unitPrice
        }
      ],
      approved: false,
      paidAmount: 0
    };

    setData((current) => ({ ...current, jobs: [job, ...current.jobs] }));
    setDraft((current) => ({ ...current, technician: "", complaint: "" }));
  }

  function updateJobStatus(jobId: string, status: JobStatus) {
    setData((current) => ({
      ...current,
      jobs: current.jobs.map((job) => job.id === jobId ? { ...job, status, approved: status !== "Waiting Approval" && job.approved } : job)
    }));
  }

  function toggleApproval(jobId: string) {
    setData((current) => ({
      ...current,
      jobs: current.jobs.map((job) => job.id === jobId ? { ...job, approved: !job.approved } : job)
    }));
  }

  return (
    <section className="panel-grid">
      <form className="panel form-card" onSubmit={addJob}>
        <h2>Open job card</h2>
        <select
          onChange={(event) => {
            const customerId = event.target.value;
            const vehicleId = data.vehicles.find((vehicle) => vehicle.customerId === customerId)?.id ?? "";
            setDraft({ ...draft, customerId, vehicleId });
          }}
          value={draft.customerId}
        >
          {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
        <select onChange={(event) => setDraft({ ...draft, vehicleId: event.target.value })} value={draft.vehicleId}>
          {customerVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} • {vehicle.make} {vehicle.model}</option>)}
        </select>
        <select onChange={(event) => setDraft({ ...draft, inventoryItemId: event.target.value })} value={draft.inventoryItemId}>
          {data.inventory.map((item) => <option key={item.id} value={item.id}>{item.name} • {formatAed(item.unitPrice)}</option>)}
        </select>
        <input onChange={(event) => setDraft({ ...draft, technician: event.target.value })} placeholder="Technician" value={draft.technician} />
        <textarea onChange={(event) => setDraft({ ...draft, complaint: event.target.value })} placeholder="Customer complaint / service request" value={draft.complaint} />
        <input onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })} type="date" value={draft.dueAt} />
        <button type="submit">Create job card</button>
      </form>

      <div className="panel span-2">
        <div className="panel-title">
          <h2>Work orders</h2>
          <span>{data.jobs.length} total</span>
        </div>
        <div className="job-list">
          {data.jobs.map((job) => {
            const totals = calculateInvoiceTotals(job, data.settings.vatRate);
            return (
              <article className="work-order" key={job.id}>
                <div className="work-order-head">
                  <div>
                    <strong>{job.jobNumber}</strong>
                    <p>{getCustomerVehicleLabel(data, job)}</p>
                  </div>
                  <span className={`status-pill status-${job.status.replace(/\s+/g, "-").toLowerCase()}`}>{job.status}</span>
                </div>
                <p>{job.complaint}</p>
                <div className="work-order-meta">
                  <span>Tech: {job.technician}</span>
                  <span>Due: {job.dueAt}</span>
                  <span>Total: {formatAed(totals.total)}</span>
                  <span>{job.approved ? "Customer approved" : "Approval pending"}</span>
                </div>
                <div className="button-row">
                  <select onChange={(event) => updateJobStatus(job.id, event.target.value as JobStatus)} value={job.status}>
                    {statusOptions.map((status) => <option key={status}>{status}</option>)}
                  </select>
                  <button onClick={() => toggleApproval(job.id)} type="button">{job.approved ? "Mark not approved" : "Approve job"}</button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function InvoicesPanel({
  data,
  selectedInvoice,
  selectedInvoiceId,
  setData,
  setSelectedInvoiceId
}: {
  data: WorkshopData;
  selectedInvoice: JobCard | undefined;
  selectedInvoiceId: string;
  setData: (updater: (data: WorkshopData) => WorkshopData) => void;
  setSelectedInvoiceId: (id: string) => void;
}) {
  const [payment, setPayment] = useState("0");

  if (!selectedInvoice) {
    return <div className="panel">Create a job card to generate an invoice.</div>;
  }

  const invoice = selectedInvoice;
  const customer = findCustomer(data, invoice.customerId);
  const vehicle = findVehicle(data, invoice.vehicleId);
  const totals = calculateInvoiceTotals(invoice, data.settings.vatRate);

  function recordPayment() {
    const amount = Number(payment);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    setData((current) => ({
      ...current,
      jobs: current.jobs.map((job) => (
        job.id === invoice.id
          ? { ...job, paidAmount: job.paidAmount + amount, status: job.status === "Ready" ? "Invoiced" : job.status }
          : job
      ))
    }));
    setPayment("0");
  }

  return (
    <section className="panel-grid">
      <div className="panel form-card">
        <h2>Invoice selector</h2>
        <select onChange={(event) => setSelectedInvoiceId(event.target.value)} value={selectedInvoiceId}>
          {data.jobs.map((job) => <option key={job.id} value={job.id}>{job.jobNumber} • {findCustomer(data, job.customerId)?.name}</option>)}
        </select>
        <input onChange={(event) => setPayment(event.target.value)} type="number" value={payment} />
        <button onClick={recordPayment} type="button">Record payment</button>
        <button onClick={() => window.print()} type="button">Print / save PDF</button>
      </div>

      <div className="panel invoice-preview span-2">
        <div className="invoice-head">
          <div>
            <h2>{data.settings.name}</h2>
            <p>{data.settings.emirate} • {data.settings.phone}</p>
            <p>TRN: {data.settings.trn}</p>
          </div>
          <div>
            <strong>Tax Invoice</strong>
            <span>{invoice.jobNumber}</span>
            <span>{invoice.openedAt}</span>
          </div>
        </div>
        <div className="invoice-customer">
          <div>
            <small>Bill to</small>
            <strong>{customer?.name ?? "Walk-in customer"}</strong>
            <span>{customer?.phone}</span>
            <span>{customer?.trn ? `Customer TRN: ${customer.trn}` : "Consumer invoice"}</span>
          </div>
          <div>
            <small>Vehicle</small>
            <strong>{vehicle ? `${vehicle.plate} • ${vehicle.make} ${vehicle.model}` : "Vehicle pending"}</strong>
            <span>VIN: {vehicle?.vin || "N/A"}</span>
            <span>Odometer: {vehicle?.odometerKm.toLocaleString("en-AE")} km</span>
          </div>
        </div>
        <div className="invoice-lines">
          <div className="table-row table-head">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Total</span>
          </div>
          {invoice.lines.map((line) => (
            <div className="table-row" key={line.id}>
              <span>{line.itemName}<small>{line.type}</small></span>
              <span>{line.quantity}</span>
              <span>{formatAed(line.unitPrice)}</span>
              <span>{formatAed(line.quantity * line.unitPrice)}</span>
            </div>
          ))}
        </div>
        <div className="invoice-total">
          <span>Subtotal <strong>{formatAed(totals.subtotal)}</strong></span>
          <span>VAT {(data.settings.vatRate * 100).toFixed(0)}% <strong>{formatAed(totals.vat)}</strong></span>
          <span>Total <strong>{formatAed(totals.total)}</strong></span>
          <span>Paid <strong>{formatAed(totals.paid)}</strong></span>
          <span className="balance">Balance <strong>{formatAed(totals.balance)}</strong></span>
        </div>
      </div>
    </section>
  );
}

function InventoryPanel({ data, setData }: { data: WorkshopData; setData: (updater: (data: WorkshopData) => WorkshopData) => void }) {
  const [draft, setDraft] = useState({
    sku: "",
    name: "",
    category: "part" as InventoryCategory,
    stock: "1",
    reorderLevel: "1",
    unitPrice: "0",
    supplier: ""
  });

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) {
      return;
    }

    setData((current) => ({
      ...current,
      inventory: [
        {
          id: createId("inv"),
          sku: draft.sku.trim().toUpperCase(),
          name: draft.name.trim(),
          category: draft.category,
          stock: Number(draft.stock),
          reorderLevel: Number(draft.reorderLevel),
          unitPrice: Number(draft.unitPrice),
          supplier: draft.supplier.trim()
        },
        ...current.inventory
      ]
    }));
    setDraft({ sku: "", name: "", category: "part", stock: "1", reorderLevel: "1", unitPrice: "0", supplier: "" });
  }

  return (
    <section className="panel-grid">
      <form className="panel form-card" onSubmit={addItem}>
        <h2>Add part / service</h2>
        <input onChange={(event) => setDraft({ ...draft, sku: event.target.value })} placeholder="SKU" value={draft.sku} />
        <input onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Item name" value={draft.name} />
        <select onChange={(event) => setDraft({ ...draft, category: event.target.value as InventoryCategory })} value={draft.category}>
          {categoryOptions.map((category) => <option key={category}>{category}</option>)}
        </select>
        <div className="two-col">
          <input onChange={(event) => setDraft({ ...draft, stock: event.target.value })} type="number" value={draft.stock} />
          <input onChange={(event) => setDraft({ ...draft, reorderLevel: event.target.value })} type="number" value={draft.reorderLevel} />
        </div>
        <input onChange={(event) => setDraft({ ...draft, unitPrice: event.target.value })} type="number" value={draft.unitPrice} />
        <input onChange={(event) => setDraft({ ...draft, supplier: event.target.value })} placeholder="Supplier" value={draft.supplier} />
        <button type="submit">Save inventory item</button>
      </form>

      <div className="panel span-2">
        <div className="panel-title">
          <h2>Parts, tires, labor and canned services</h2>
          <span>{data.inventory.length} items</span>
        </div>
        <div className="table inventory-table">
          <div className="table-row table-head">
            <span>SKU</span>
            <span>Item</span>
            <span>Stock</span>
            <span>Price</span>
          </div>
          {data.inventory.map((item) => (
            <div className={item.stock <= item.reorderLevel ? "table-row low-stock" : "table-row"} key={item.id}>
              <span>{item.sku}</span>
              <span>{item.name}<small>{item.category} • {item.supplier}</small></span>
              <span>{item.stock} / reorder {item.reorderLevel}</span>
              <span>{formatAed(item.unitPrice)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AppointmentsPanel({ data, setData }: { data: WorkshopData; setData: (updater: (data: WorkshopData) => WorkshopData) => void }) {
  const firstCustomerId = data.customers[0]?.id ?? "";
  const firstVehicleId = data.vehicles.find((vehicle) => vehicle.customerId === firstCustomerId)?.id ?? "";
  const [draft, setDraft] = useState({
    date: todayIso(),
    time: "09:00",
    customerId: firstCustomerId,
    vehicleId: firstVehicleId,
    service: ""
  });

  function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.customerId || !draft.vehicleId || !draft.service.trim()) {
      return;
    }

    setData((current) => ({
      ...current,
      appointments: [
        {
          id: createId("apt"),
          date: normalizeDateInput(draft.date),
          time: draft.time,
          customerId: draft.customerId,
          vehicleId: draft.vehicleId,
          service: draft.service.trim(),
          status: "Requested"
        },
        ...current.appointments
      ]
    }));
    setDraft((current) => ({ ...current, service: "" }));
  }

  function updateStatus(appointmentId: string, status: AppointmentStatus) {
    setData((current) => ({
      ...current,
      appointments: current.appointments.map((appointment) => (
        appointment.id === appointmentId ? { ...appointment, status } : appointment
      ))
    }));
  }

  return (
    <section className="panel-grid">
      <form className="panel form-card" onSubmit={addAppointment}>
        <h2>Book appointment</h2>
        <div className="two-col">
          <input onChange={(event) => setDraft({ ...draft, date: event.target.value })} type="date" value={draft.date} />
          <input onChange={(event) => setDraft({ ...draft, time: event.target.value })} type="time" value={draft.time} />
        </div>
        <select
          onChange={(event) => {
            const customerId = event.target.value;
            const vehicleId = data.vehicles.find((vehicle) => vehicle.customerId === customerId)?.id ?? "";
            setDraft({ ...draft, customerId, vehicleId });
          }}
          value={draft.customerId}
        >
          {data.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </select>
        <select onChange={(event) => setDraft({ ...draft, vehicleId: event.target.value })} value={draft.vehicleId}>
          {data.vehicles.filter((vehicle) => vehicle.customerId === draft.customerId).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} • {vehicle.model}</option>)}
        </select>
        <textarea onChange={(event) => setDraft({ ...draft, service: event.target.value })} placeholder="Service request" value={draft.service} />
        <button type="submit">Save appointment</button>
      </form>

      <div className="panel span-2">
        <div className="panel-title">
          <h2>Calendar</h2>
          <span>Offline reminders list</span>
        </div>
        <div className="table appointments-table">
          <div className="table-row table-head">
            <span>Date</span>
            <span>Customer / vehicle</span>
            <span>Service</span>
            <span>Status</span>
          </div>
          {data.appointments.map((appointment) => (
            <div className="table-row" key={appointment.id}>
              <span>{normalizeDateInput(appointment.date)}<small>{appointment.time}</small></span>
              <span>{getCustomerVehicleLabel(data, appointment)}</span>
              <span>{appointment.service}</span>
              <span>
                <select onChange={(event) => updateStatus(appointment.id, event.target.value as AppointmentStatus)} value={appointment.status}>
                  {appointmentStatusOptions.map((status) => <option key={status}>{status}</option>)}
                </select>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportsPanel({ data }: { data: WorkshopData }) {
  const jobsByStatus = statusOptions.map((status) => ({
    status,
    count: data.jobs.filter((job) => job.status === status).length
  }));
  const revenueByJob = data.jobs.map((job) => ({
    job,
    totals: calculateInvoiceTotals(job, data.settings.vatRate)
  }));
  const totalVat = revenueByJob.reduce((sum, item) => sum + item.totals.vat, 0);
  const totalSales = revenueByJob.reduce((sum, item) => sum + item.totals.total, 0);

  return (
    <section className="panel-grid">
      <div className="panel">
        <div className="panel-title">
          <h2>VAT summary</h2>
          <span>UAE tax ready</span>
        </div>
        <div className="report-stat"><span>Taxable sales</span><strong>{formatAed(totalSales - totalVat)}</strong></div>
        <div className="report-stat"><span>Output VAT</span><strong>{formatAed(totalVat)}</strong></div>
        <div className="report-stat"><span>Gross sales</span><strong>{formatAed(totalSales)}</strong></div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Job pipeline</h2>
          <span>Operational status</span>
        </div>
        {jobsByStatus.map((item) => (
          <div className="bar-row" key={item.status}>
            <span>{item.status}</span>
            <meter max={Math.max(data.jobs.length, 1)} value={item.count} />
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>

      <div className="panel span-2">
        <div className="panel-title">
          <h2>Invoice ledger</h2>
          <span>Export by backup for accounting handoff</span>
        </div>
        <div className="table">
          <div className="table-row table-head">
            <span>Invoice</span>
            <span>Customer</span>
            <span>VAT</span>
            <span>Balance</span>
          </div>
          {revenueByJob.map(({ job, totals }) => (
            <div className="table-row" key={job.id}>
              <span>{job.jobNumber}</span>
              <span>{findCustomer(data, job.customerId)?.name ?? "Walk-in"}</span>
              <span>{formatAed(totals.vat)}</span>
              <span>{formatAed(totals.balance)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SettingsPanel({ data, setData }: { data: WorkshopData; setData: (updater: (data: WorkshopData) => WorkshopData) => void }) {
  const [settings, setSettings] = useState(data.settings);

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setData((current) => ({ ...current, settings }));
  }

  return (
    <section className="panel-grid">
      <form className="panel form-card" onSubmit={saveSettings}>
        <h2>Workshop profile</h2>
        <input onChange={(event) => setSettings({ ...settings, name: event.target.value })} value={settings.name} />
        <select onChange={(event) => setSettings({ ...settings, emirate: event.target.value })} value={settings.emirate}>
          {emirates.map((emirate) => <option key={emirate}>{emirate}</option>)}
        </select>
        <input onChange={(event) => setSettings({ ...settings, phone: event.target.value })} value={settings.phone} />
        <input onChange={(event) => setSettings({ ...settings, trn: event.target.value })} placeholder="15-digit UAE TRN" value={settings.trn} />
        <input onChange={(event) => setSettings({ ...settings, vatRate: Number(event.target.value) / 100 })} type="number" value={settings.vatRate * 100} />
        <input onChange={(event) => setSettings({ ...settings, invoicePrefix: event.target.value.toUpperCase() })} value={settings.invoicePrefix} />
        <button type="submit">Save UAE settings</button>
      </form>

      <div className="panel span-2">
        <div className="panel-title">
          <h2>Included offline modules</h2>
          <span>No recurring billing logic</span>
        </div>
        <div className="feature-grid">
          {[
            "Customers, fleets and vehicles",
            "Job cards and technician assignments",
            "Estimates and UAE VAT invoices",
            "Parts, tires, services and reorder alerts",
            "Appointment calendar and service reminders",
            "Payment balances and invoice ledger",
            "Backup export and import",
            "Electron packaging for Windows installer"
          ].map((feature) => (
            <div className="feature-card" key={feature}>{feature}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default App;
