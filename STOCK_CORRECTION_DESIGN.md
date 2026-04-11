# Stock Correction — Design & Implementation Guide

---

## Problem Statement

**Current situation:**
- `inventory_stock` table madhe `inwardQty = 4000` dakhvat ahe
- Physical count kela tr actual stock `5000` ahe
- Data Center Manager la he correct karayche ahe
- **Requirement:** Original data (4000) pan rahila pahije + corrected data (5000) pan dila pahije

---

## Current Data Model (Existing)

```
inventory_stock table:
  id, location_id, company_id, product_id, variant_id
  inwardQty, inwardAmt
  dumpQty, dumpAmt
  createdAt, updatedAt, isDeleted
```

**Problem with directly updating `inwardQty`:**
- History lost ho jaato — 4000 kuthun aala, 5000 kasa zala — kahi trace nahi
- Audit trail nahi
- Kon ne correct kela, keva kela — kahi nahi

---

## Best Approach: Stock Correction Log Table (Recommended)

### Core Idea
`inventory_stock` la directly update karne **nahi**. Ek alag `stock_correction` table banav.
- Original record as-is rahto
- Correction ek **separate entry** hote with reason, who did it, when
- Final stock = `inwardQty + correctionDelta`

---

## Entity 1: `InventoryStock` (existing — minor addition)

`inwardQty` la touch karne nahi. Fakt ek computed/virtual field add kara:

```typescript
// inventoryStock.entity.ts madhe add kara (optional helper)
// DB column nahi — just for reference
get effectiveQty(): number {
  // Service layer madhe calculate kara
}
```

---

## Entity 2: `StockCorrection` (NEW — banvaychi)

```typescript
// src/entities/stockCorrection.entity.ts

import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import Model from "./model.entity";
import { InventoryStock } from "./inventoryStock.entity";
import { User } from "./user.entity";
import { Branches } from "./branches.entity";
import { Company } from "./company.entity";
import { Product } from "./product.entity";
import { ProductVarient } from "./productVarient.entity";

export enum CorrectionStatus {
  PENDING = "pending",       // Manager ne submit kela, approval baki
  APPROVED = "approved",     // Approved — stock effective
  REJECTED = "rejected",     // Rejected — stock unchanged
}

export enum CorrectionType {
  PHYSICAL_COUNT = "physical_count",   // Physical count madhe difference
  DAMAGE_WRITE_OFF = "damage_write_off",
  SYSTEM_ERROR = "system_error",
  OTHER = "other",
}

@Entity("stock_correction")
export class StockCorrection extends Model {

  // Link to the inventory_stock record being corrected
  @ManyToOne(() => InventoryStock, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "inventory_stock_id" })
  inventoryStock: InventoryStock;

  // Denormalized for easy querying (same as inventoryStock relations)
  @ManyToOne(() => Company, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "company_id" })
  company: Company;

  @ManyToOne(() => Branches, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "location_id" })
  location: Branches;

  @ManyToOne(() => Product, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "product_id" })
  product: Product;

  @ManyToOne(() => ProductVarient, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "variant_id" })
  variant: ProductVarient;

  // --- The actual correction numbers ---

  @Column("decimal", { precision: 10, scale: 2 })
  systemQty: number;        // DB madhe jo qty hota (4000)

  @Column("decimal", { precision: 10, scale: 2 })
  physicalQty: number;      // Physical count madhe jo aala (5000)

  @Column("decimal", { precision: 10, scale: 2 })
  correctionDelta: number;  // physicalQty - systemQty = +1000 (auto-calculated)

  @Column("decimal", { precision: 12, scale: 2, default: 0 })
  correctionAmt: number;    // Amount adjustment (optional)

  // --- Metadata ---

  @Column({ type: "enum", enum: CorrectionType, default: CorrectionType.PHYSICAL_COUNT })
  correctionType: CorrectionType;

  @Column({ type: "enum", enum: CorrectionStatus, default: CorrectionStatus.PENDING })
  status: CorrectionStatus;

  @Column({ nullable: true })
  reason: string;           // "Physical count on 10-Apr-2026 showed 5000 bags"

  @Column({ nullable: true })
  remarks: string;          // Approver remarks

  // --- Who did what ---

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by" })
  createdBy: User;          // Data Center Manager (jo ne correction submit kela)

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "approved_by" })
  approvedBy: User;         // Senior / Admin (jo ne approve kela)

  @Column({ type: "timestamp", nullable: true })
  approvedAt: Date;

  @Column({ type: "date", nullable: true })
  correctionDate: Date;     // Keva physical count kela
}
```

---

## Flow: How It Works

```
Step 1: Manager submits correction
  → StockCorrection record create hoto
  → status = PENDING
  → systemQty = 4000, physicalQty = 5000, correctionDelta = +1000

Step 2: Admin/Senior approves
  → status = APPROVED
  → inventory_stock.inwardQty += correctionDelta  (4000 → 5000)
  → approvedBy, approvedAt set hote

Step 3: API response madhe dono data milto
  → systemQty: 4000  (original)
  → physicalQty: 5000  (corrected)
  → correctionDelta: +1000
  → status: approved
  → correctedBy: "Manager Name"
  → approvedBy: "Admin Name"
```

---

## Service Logic (Key Methods)

### 1. Submit Correction
```typescript
async submitCorrection(dto: CreateStockCorrectionDto, userId: string) {
  const stock = await this.inventoryStockRepo.findOne({ where: { id: dto.inventoryStockId } });

  const delta = dto.physicalQty - Number(stock.inwardQty);

  const correction = this.stockCorrectionRepo.create({
    inventoryStock: { id: stock.id },
    company: stock.company,
    location: stock.location,
    product: stock.product,
    variant: stock.variant,
    systemQty: stock.inwardQty,       // snapshot of current
    physicalQty: dto.physicalQty,
    correctionDelta: delta,
    correctionType: dto.correctionType,
    reason: dto.reason,
    correctionDate: dto.correctionDate,
    status: CorrectionStatus.PENDING,
    createdBy: { id: userId },
  });

  return this.stockCorrectionRepo.save(correction);
}
```

### 2. Approve Correction (updates actual stock)
```typescript
async approveCorrection(correctionId: string, approverId: string) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const correction = await this.stockCorrectionRepo.findOne({
      where: { id: correctionId },
      relations: ['inventoryStock'],
    });

    if (correction.status !== CorrectionStatus.PENDING) {
      throw new Error('Already processed');
    }

    // Update actual stock
    const stock = correction.inventoryStock;
    stock.inwardQty = Number(stock.inwardQty) + Number(correction.correctionDelta);
    await queryRunner.manager.save(stock);

    // Mark correction approved
    correction.status = CorrectionStatus.APPROVED;
    correction.approvedBy = { id: approverId } as any;
    correction.approvedAt = new Date();
    await queryRunner.manager.save(correction);

    await queryRunner.commitTransaction();
    return correction;
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

### 3. Get Stock with Correction History
```typescript
async getStockWithCorrections(inventoryStockId: string) {
  const stock = await this.inventoryStockRepo.findOne({
    where: { id: inventoryStockId },
    relations: ['product', 'variant', 'location'],
  });

  const corrections = await this.stockCorrectionRepo.find({
    where: { inventoryStock: { id: inventoryStockId } },
    relations: ['createdBy', 'approvedBy'],
    order: { createdAt: 'DESC' },
  });

  return {
    currentStock: stock,
    corrections,                          // Full history
    pendingCorrections: corrections.filter(c => c.status === 'pending'),
  };
}
```

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/stock-correction` | Submit new correction |
| GET | `/stock-correction/:inventoryStockId` | Get corrections for a stock |
| PATCH | `/stock-correction/:id/approve` | Approve correction |
| PATCH | `/stock-correction/:id/reject` | Reject correction |
| GET | `/stock-correction/pending` | All pending corrections |

---

## Files to Create

```
src/entities/stockCorrection.entity.ts        ← NEW entity
src/repositories/stockCorrection.repository.ts ← NEW repo
src/services/stockCorrection.service.ts        ← NEW service
src/controllers/stockCorrection.controller.ts  ← NEW controller
src/dtos/stockCorrection.dto.ts               ← NEW DTO
```

---

## Why This Approach is Best

| Concern | This Approach |
|---------|--------------|
| Original data preserved? | ✅ `systemQty` snapshot stored |
| Corrected data available? | ✅ `physicalQty` + updated `inwardQty` |
| Who corrected? | ✅ `createdBy` |
| When corrected? | ✅ `correctionDate`, `createdAt` |
| Approval workflow? | ✅ PENDING → APPROVED/REJECTED |
| Full history? | ✅ Multiple corrections per stock |
| Rollback possible? | ✅ Rejected corrections don't touch stock |
| Audit trail? | ✅ Complete |

---

## Alternative Approaches (and why not)

### ❌ Direct Update
Just `UPDATE inventory_stock SET inwardQty = 5000`
- History lost, no audit, dangerous

### ❌ Soft versioning (keep old row, create new)
- Complex queries, duplicate data, hard to maintain

### ✅ Correction Log (recommended above)
- Clean, auditable, approval-ready, industry standard

---

## Summary

**Ek line madhe:** `inventory_stock` la touch karne nahi directly — ek `stock_correction` table banav jo snapshot gheto (4000), corrected value store karto (5000), approval workflow handle karto, ani approve zala ki maga actual stock update hoto. Dono data always available rahto.
