import { Repository } from 'typeorm';
import { InvoiceProduct } from '../entities/invoiceProduct.entity';

export class InvoiceProductRepository extends Repository<InvoiceProduct> {}
