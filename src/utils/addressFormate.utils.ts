import { Address } from "../entities/address.entity";

export function formatAddress(address?: Address): string {
  if (!address) return '';

  const parts = [
    address.address1,
    address.address2,
    address.city,
    address.state,
    address.pincode,
    address.location,
  ];

  return parts.filter(Boolean).join(', ');
}