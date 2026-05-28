# Draft Feature API Documentation

All endpoints require Authorization header (Bearer token).

---

## FARMER

### 1. Create Farmer as Draft
**POST** `/farmers`

**Body:**
```json
{
  "farmerfName": "Ramesh",
  "farmermName": "Kumar",
  "farmerlName": "Patil",
  "primaryMobileNo": "9876543210",
  "status": "draft"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Farmer created successfully",
  "data": "uuid-of-farmer"
}
```

---

### 2. Create Farmer (Direct Submit)
**POST** `/farmers`

**Body:**
```json
{
  "farmerfName": "Ramesh",
  "farmermName": "Kumar",
  "farmerlName": "Patil",
  "primaryMobileNo": "9876543210",
  "status": "pending"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Farmer created successfully",
  "data": "uuid-of-farmer"
}
```

---

### 3. Submit Existing Draft Farmer
**PATCH** `/farmers/submit/:id`

**Params:** `id` — farmer UUID

**Body:** _(empty)_

**Response:**
```json
{
  "status": "success",
  "message": "Farmer submitted successfully",
  "data": {
    "id": "uuid-of-farmer",
    "status": "pending"
  }
}
```

---

## CUSTOMER

### 1. Create Customer as Draft
**POST** `/customers`

**Body:**
```json
{
  "organisationName": "ABC Traders",
  "primaryContactNo": "9876543210",
  "emailPrimary": "abc@example.com",
  "status": "draft"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Customer created successfully",
  "data": {
    "id": "uuid-of-customer",
    "organisationName": "ABC Traders",
    "customerCode": "CUST0001",
    "status": "draft"
  }
}
```

---

### 2. Create Customer (Direct Submit)
**POST** `/customers`

**Body:**
```json
{
  "organisationName": "ABC Traders",
  "primaryContactNo": "9876543210",
  "emailPrimary": "abc@example.com",
  "status": "pending"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Customer created successfully",
  "data": {
    "id": "uuid-of-customer",
    "organisationName": "ABC Traders",
    "customerCode": "CUST0001",
    "status": "pending"
  }
}
```

---

### 3. Submit Existing Draft Customer
**PATCH** `/customers/submit/:id`

**Params:** `id` — customer UUID

**Body:** _(empty)_

**Response:**
```json
{
  "status": "success",
  "message": "Customer submitted successfully",
  "data": {
    "id": "uuid-of-customer",
    "status": "pending"
  }
}
```

---

## VENDOR

### 1. Create Vendor as Draft
**POST** `/vendors`

**Body (multipart/form-data):**
```
companyName: "XYZ Supplies"
officeContactNo: "9876543210"
status: "draft"
```

**Response:**
```json
{
  "status": "success",
  "message": "Vendor created successfully",
  "data": "uuid-of-vendor"
}
```

---

### 2. Create Vendor (Direct Submit)
**POST** `/vendors`

**Body (multipart/form-data):**
```
companyName: "XYZ Supplies"
officeContactNo: "9876543210"
status: "pending"
```

**Response:**
```json
{
  "status": "success",
  "message": "Vendor created successfully",
  "data": "uuid-of-vendor"
}
```

---

### 3. Submit Existing Draft Vendor
**PATCH** `/vendors/submit/:id`

**Params:** `id` — vendor UUID

**Body:** _(empty)_

**Response:**
```json
{
  "status": "success",
  "message": "Vendor submitted successfully",
  "data": {
    "id": "uuid-of-vendor",
    "status": "pending"
  }
}
```

---

## Status Flow

```
Draft button click   →  POST   /farmers | /customers | /vendors   { status: "draft" }
Create button click  →  POST   /farmers | /customers | /vendors   { status: "pending" }
Submit saved draft   →  PATCH  /farmers/submit/:id                (status → "pending")
Admin approve        →  PATCH  /farmers/approve/:id?status=approved
Admin reject         →  PATCH  /farmers/approve/:id?status=notapproved
```

---

## Possible Status Values

| Value        | Meaning                          |
|--------------|----------------------------------|
| `draft`      | Saved as draft by user           |
| `incomplete` | Alternate draft state            |
| `pending`    | Submitted, waiting for approval  |
| `approved`   | Approved by admin                |
| `notapproved`| Rejected by admin                |
