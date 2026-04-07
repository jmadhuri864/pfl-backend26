# Permission System — Idea

## Ek table, sab kuch handle

Existing `document_permissions` table ch extend karo.
Navi table nahi, navi entity nahi.

---

## DocumentDefinition madhe navi types add karo

```
REPORT    = "REPORT"
INVENTORY = "INVENTORY"
```

Seed madhe navi rows takaycha:
- `{ uniqueKey: 'inventory', name: 'Inventory', documentType: 'INVENTORY' }`
- `{ uniqueKey: 'sales-report', name: 'Sales Report', documentType: 'REPORT' }`
- `{ uniqueKey: 'registration-report', name: 'Registration Report', documentType: 'REPORT' }`
- ... (jitke reports ahet tithe)

---

## DocumentPermission entity madhe ek column add karo

```ts
@Column({ default: false })
canViewAllLocations: boolean;
```

Baaki columns same rahtat:
canCreate / canView / canEdit / canDelete / canDownload

---

## Inventory location filter logic (service madhe)

```
if (permission.canViewAllLocations === true)
    → WHERE no location filter  (sab locations dikhao)

if (permission.canViewAllLocations === false)
    → WHERE stock.location = user.currentWorkLocation
      OR stock.location IN (user.accessLocation[])
```

---

## Flow summary

Admin panel madhe user la permission deto:
1. documentDefinition = "Inventory" select karo
2. canView = true
3. canViewAllLocations = true/false set karo

Inventory API madhe:
1. logged user chi permission check karo
2. canViewAllLocations false asel tr currentWorkLocation + accessLocation filter lav
3. canViewAllLocations true asel tr sab data dya

---

## Files touch honar

| File | Change |
|------|--------|
| `src/entities/documentdef.entity.ts` | REPORT, INVENTORY enum add |
| `src/entities/permission.entity.ts` | `canViewAllLocations` column add |
| `src/seed/documentSeed.ts` | navi document definitions seed karo |
| `src/services/inventoryStock.service.ts` | location filter logic add karo |
| `src/middleware/checkPermission.ts` | INVENTORY/REPORT check add karo |

---

## Avadli tr sang — implement karto.
