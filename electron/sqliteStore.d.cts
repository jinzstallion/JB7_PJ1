import type { Database } from "sql.js";
import type { WorkshopData } from "../src/domain/workshop";

export declare function ensureSchema(db: Database): void;
export declare function readWorkshopData(db: Database): WorkshopData | null;
export declare function writeWorkshopData(db: Database, data: WorkshopData): void;
