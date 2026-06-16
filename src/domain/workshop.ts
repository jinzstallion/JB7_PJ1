export type JobStatus =
  | "Booked"
  | "In Progress"
  | "Waiting Approval"
  | "Ready"
  | "Invoiced";

export type InventoryCategory = "part" | "service" | "tire" | "consumable";

export type AppointmentStatus = "Requested" | "Confirmed" | "Completed" | "Cancelled";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  emirate: string;
  trn?: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  vin: string;
  odometerKm: number;
  nextServiceKm: number;
}

export interface JobLine {
  id: string;
  type: InventoryCategory;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface JobCard {
  id: string;
  jobNumber: string;
  customerId: string;
  vehicleId: string;
  status: JobStatus;
  technician: string;
  openedAt: string;
  dueAt: string;
  complaint: string;
  inspection: string;
  recommendations: string;
  lines: JobLine[];
  approved: boolean;
  paidAmount: number;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  stock: number;
  reorderLevel: number;
  unitPrice: number;
  supplier: string;
}

export interface Appointment {
  id: string;
  date: string;
  time: string;
  customerId: string;
  vehicleId: string;
  service: string;
  status: AppointmentStatus;
}

export interface WorkshopSettings {
  name: string;
  emirate: string;
  phone: string;
  trn: string;
  vatRate: number;
  invoicePrefix: string;
}

export interface WorkshopData {
  settings: WorkshopSettings;
  customers: Customer[];
  vehicles: Vehicle[];
  jobs: JobCard[];
  inventory: InventoryItem[];
  appointments: Appointment[];
}

export interface InvoiceTotals {
  subtotal: number;
  vat: number;
  total: number;
  paid: number;
  balance: number;
}

export interface DashboardStats {
  activeJobs: number;
  todaysAppointments: number;
  monthlyRevenue: number;
  outstandingBalance: number;
  lowStockCount: number;
}

export const STORAGE_KEY = "jb7-uae-workshop-offline-v1";

export const AED_FORMATTER = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 2
});

export function formatAed(amount: number): string {
  return AED_FORMATTER.format(roundMoney(amount));
}

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculateLineSubtotal(line: Pick<JobLine, "quantity" | "unitPrice">): number {
  return roundMoney(line.quantity * line.unitPrice);
}

export function calculateInvoiceTotals(job: Pick<JobCard, "lines" | "paidAmount">, vatRate: number): InvoiceTotals {
  const subtotal = roundMoney(
    job.lines.reduce((sum, line) => sum + calculateLineSubtotal(line), 0)
  );
  const vat = roundMoney(subtotal * vatRate);
  const total = roundMoney(subtotal + vat);
  const paid = roundMoney(job.paidAmount);

  return {
    subtotal,
    vat,
    total,
    paid,
    balance: roundMoney(total - paid)
  };
}

export function findCustomer(data: WorkshopData, customerId: string): Customer | undefined {
  return data.customers.find((customer) => customer.id === customerId);
}

export function findVehicle(data: WorkshopData, vehicleId: string): Vehicle | undefined {
  return data.vehicles.find((vehicle) => vehicle.id === vehicleId);
}

export function getCustomerVehicleLabel(data: WorkshopData, job: Pick<JobCard, "customerId" | "vehicleId">): string {
  const customer = findCustomer(data, job.customerId);
  const vehicle = findVehicle(data, job.vehicleId);
  const customerName = customer?.name ?? "Walk-in customer";
  const vehicleName = vehicle ? `${vehicle.plate} - ${vehicle.make} ${vehicle.model}` : "Vehicle pending";
  return `${customerName} / ${vehicleName}`;
}

export function getLowStockItems(inventory: InventoryItem[]): InventoryItem[] {
  return inventory.filter((item) => item.stock <= item.reorderLevel);
}

export function getDashboardStats(data: WorkshopData, today: string): DashboardStats {
  const monthPrefix = today.slice(0, 7);
  const activeJobs = data.jobs.filter((job) => job.status !== "Invoiced").length;
  const todaysAppointments = data.appointments.filter((appointment) => appointment.date === today).length;
  const invoicedThisMonth = data.jobs.filter(
    (job) => job.status === "Invoiced" && job.openedAt.startsWith(monthPrefix)
  );

  return {
    activeJobs,
    todaysAppointments,
    monthlyRevenue: roundMoney(
      invoicedThisMonth.reduce(
        (sum, job) => sum + calculateInvoiceTotals(job, data.settings.vatRate).total,
        0
      )
    ),
    outstandingBalance: roundMoney(
      data.jobs.reduce((sum, job) => sum + calculateInvoiceTotals(job, data.settings.vatRate).balance, 0)
    ),
    lowStockCount: getLowStockItems(data.inventory).length
  };
}

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createSeedData(today = new Date().toISOString().slice(0, 10)): WorkshopData {
  const customers: Customer[] = [
    {
      id: "cust-emirates-fleet",
      name: "Emirates Delivery Fleet",
      phone: "+971 55 210 4411",
      email: "fleet@example.ae",
      emirate: "Dubai",
      trn: "100238912300003"
    },
    {
      id: "cust-al-noor",
      name: "Al Noor Trading LLC",
      phone: "+971 50 884 1900",
      email: "ops@alnoor.example",
      emirate: "Sharjah"
    }
  ];

  const vehicles: Vehicle[] = [
    {
      id: "veh-nissan-patrol",
      customerId: "cust-emirates-fleet",
      plate: "D 48291",
      make: "Nissan",
      model: "Patrol",
      year: 2021,
      vin: "JN8BY2NY8M9000001",
      odometerKm: 84200,
      nextServiceKm: 90000
    },
    {
      id: "veh-toyota-hiace",
      customerId: "cust-al-noor",
      plate: "SHJ 77423",
      make: "Toyota",
      model: "Hiace",
      year: 2019,
      vin: "JTFSX23P8K6000002",
      odometerKm: 136800,
      nextServiceKm: 140000
    }
  ];

  const inventory: InventoryItem[] = [
    {
      id: "inv-oil-5w30",
      sku: "OIL-5W30-4L",
      name: "Synthetic engine oil 5W-30",
      category: "consumable",
      stock: 18,
      reorderLevel: 8,
      unitPrice: 145,
      supplier: "Dubai Auto Parts"
    },
    {
      id: "inv-brake-pad",
      sku: "BRK-PATROL-F",
      name: "Front brake pad set - Patrol",
      category: "part",
      stock: 3,
      reorderLevel: 4,
      unitPrice: 420,
      supplier: "Al Quoz Spares"
    },
    {
      id: "inv-labor-general",
      sku: "LAB-GEN",
      name: "General mechanic labor",
      category: "service",
      stock: 999,
      reorderLevel: 0,
      unitPrice: 180,
      supplier: "In-house"
    },
    {
      id: "inv-tire-265",
      sku: "TYR-265-70R17",
      name: "All-terrain tire 265/70R17",
      category: "tire",
      stock: 6,
      reorderLevel: 4,
      unitPrice: 610,
      supplier: "Jebel Ali Tyres"
    }
  ];

  const jobs: JobCard[] = [
    {
      id: "job-1001",
      jobNumber: "JB7-1001",
      customerId: "cust-emirates-fleet",
      vehicleId: "veh-nissan-patrol",
      status: "In Progress",
      technician: "Rashid",
      openedAt: today,
      dueAt: today,
      complaint: "Brake vibration above 80 km/h and periodic service due.",
      inspection: "Front pads near minimum thickness; rotors require skimming.",
      recommendations: "Replace front pads, skim rotors, perform 80k service.",
      approved: true,
      paidAmount: 0,
      lines: [
        {
          id: "line-brake-pad",
          type: "part",
          itemName: "Front brake pad set - Patrol",
          quantity: 1,
          unitPrice: 420
        },
        {
          id: "line-labor-brakes",
          type: "service",
          itemName: "Brake service labor",
          quantity: 2.5,
          unitPrice: 180
        }
      ]
    },
    {
      id: "job-1002",
      jobNumber: "JB7-1002",
      customerId: "cust-al-noor",
      vehicleId: "veh-toyota-hiace",
      status: "Invoiced",
      technician: "Joseph",
      openedAt: today.slice(0, 8) + "01",
      dueAt: today.slice(0, 8) + "02",
      complaint: "AC cooling weak at idle.",
      inspection: "Low refrigerant and cabin filter blocked.",
      recommendations: "Recharge AC and replace cabin filter.",
      approved: true,
      paidAmount: 520,
      lines: [
        {
          id: "line-ac-service",
          type: "service",
          itemName: "AC diagnosis and gas recharge",
          quantity: 1,
          unitPrice: 420
        },
        {
          id: "line-cabin-filter",
          type: "part",
          itemName: "Cabin filter",
          quantity: 1,
          unitPrice: 95
        }
      ]
    }
  ];

  const appointments: Appointment[] = [
    {
      id: "apt-patrol",
      date: today,
      time: "10:30",
      customerId: "cust-emirates-fleet",
      vehicleId: "veh-nissan-patrol",
      service: "Brake inspection and service",
      status: "Confirmed"
    }
  ];

  return {
    settings: {
      name: "JB7 BizHub Auto Workshop",
      emirate: "Dubai",
      phone: "+971 4 000 0000",
      trn: "100000000000003",
      vatRate: 0.05,
      invoicePrefix: "JB7"
    },
    customers,
    vehicles,
    jobs,
    inventory,
    appointments
  };
}

export function isWorkshopData(value: unknown): value is WorkshopData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<WorkshopData>;
  return (
    typeof candidate.settings === "object" &&
    Array.isArray(candidate.customers) &&
    Array.isArray(candidate.vehicles) &&
    Array.isArray(candidate.jobs) &&
    Array.isArray(candidate.inventory) &&
    Array.isArray(candidate.appointments)
  );
}
