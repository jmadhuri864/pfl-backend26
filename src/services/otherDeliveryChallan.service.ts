import { inject, injectable } from 'inversify';
import { TYPES } from '../types';
import { OtherDeliveryChallanRepository } from '../repositories/otherDeliveryChallan.repository';
import logger from '../utils/logger';
import { buildQuery, PaginationOptions } from '../utils/pagination';
import { formatDateTime } from '../utils/dateUtils';
import { DataSource } from 'typeorm';


@injectable()
export class OtherDeliveryChallanService {
  constructor(
    @inject(TYPES.OtherDeliveryChallanRepository)
    private readonly challanRepository: OtherDeliveryChallanRepository,
    @inject(TYPES.DataSource)
    private readonly dataSource: DataSource
   
  ) {}

  async create(data: any): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const challan = queryRunner.manager.create(this.challanRepository.target, data);
      const savedchallan = await queryRunner.manager.save(challan);

      // Commit transaction - all operations succeeded
      await queryRunner.commitTransaction();
      
      return savedchallan;
    } catch (error: any) {
      // Rollback transaction - undo all changes
      await queryRunner.rollbackTransaction();
      console.error('Error creating GRN:', error);
      throw new Error('Failed to create GRN');
    } finally {
      // Release query runner
      await queryRunner.release();
    }
  }
  catch(err: any) {
    logger.error('Error creating other delivery challan', { error: err });
    return null;
  }

  async getById(id: string): Promise<any> {
    try {
      return await this.challanRepository.findOne({
        where: { id },
        relations: [
          'deliveryChallanProducts',
          'deliveryChallanProducts.productName',
          'deliveryChallanProducts.packagingMaterial',
          'deliveryChallanProducts.packagingMaterialUoM',
          'deliveryChallanProducts.saleUoM',
          'companyName',
          'offices',
          'grnNo',
          'toLocationInput',
          'fromLocationInput',
        ],
      });
    } catch (err) {
      logger.error(`Error fetching other delivery challan by ID: ${id}`, {
        error: err,
      });
      return null;
    }
  }

  async getByIdChallanforView(id: string): Promise<any> {
    const challan = await this.challanRepository
      .createQueryBuilder('challan')
      .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
      .leftJoinAndSelect('products.productName', 'productName')
      .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
      .leftJoinAndSelect('challan.documentApproval', 'documentApproval')
      .leftJoinAndSelect('documentApproval.documentdef', 'documentdef')
      .leftJoinAndSelect(
        'products.packagingMaterialUoM',
        'packagingMaterialUoM',
      )
      .leftJoinAndSelect('products.saleUoM', 'saleUoM')
      .leftJoinAndSelect('challan.partyName', 'partyName')
      .leftJoinAndSelect('challan.billingAddress', 'billingAddress')
      .leftJoinAndSelect('challan.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('challan.companyName', 'company')
      .leftJoinAndSelect('challan.offices', 'office')
      .leftJoinAndSelect('challan.grnNo', 'grn')
      .leftJoinAndSelect('challan.toLocationInput', 'toLocationInput')
      .leftJoinAndSelect('challan.fromLocationInput', 'fromLocationInput')
      .where('challan.id = :id', { id })
      .getOne();

    if (!challan) {
      return null;
    }

    const { createdDate, createdTime } = formatDateTime(challan.createdAt);

    const formattedChallan = {
      id: challan.id,
      challanNo: challan.challanNo,

      companyName: challan.companyName?.name || null,
      office: challan.offices?.name || null,
      grnNo: challan.grnNo?.grnNo || null,
      fromLocationInput: challan.fromLocationInput
        ? {
            id: challan.fromLocationInput.id,
            address1: challan.fromLocationInput.address1,
            address2: challan.fromLocationInput.address2,
            city: challan.fromLocationInput.city,
            state: challan.fromLocationInput.state,
            location: challan.fromLocationInput.location,
            pincode: challan.fromLocationInput.pincode,
          }
        : null,
      toLocationInput: challan.toLocationInput
        ? {
            id: challan.toLocationInput.id,
            address1: challan.toLocationInput.address1,
            address2: challan.toLocationInput.address2,
            city: challan.toLocationInput.city,
            state: challan.toLocationInput.state,
            location: challan.toLocationInput.location,
            pincode: challan.toLocationInput.pincode,
          }
        : null,
      driverName: challan.driverName,
      contactNo: challan.contactNo,
      altContactNo: challan.altContactNo,
      vehicleNo: challan.vehicleNo,
      licenseNo: challan.licenseNo,
      receiverName: challan.receiverName,
      totalProductAmount: challan.totalProductAmount,
      netProductWeight: challan.netProductWeight,
      netPackagingMaterialWeight: challan.netPackagingMaterialWeight,
      totalPackagingMaterialAmount: challan.totalPackagingMaterialAmount,
     
      totalAmtInWords: challan.totalAmtInWords,
      createdDate,
      createdTime,
      requestingDepartment: challan.requestingDepartment,
      // approvalStatus: challan.approvalStatus,
      remark: challan.remark,
      anyAttachment: challan.anyAttachment,
      deliveryChallanProducts: challan.deliveryChallanProducts.map(
        (product) => ({
          id: product.id,
          productName: product.productName?.name,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount,
          saleUoM: product.saleUoM?.unit || null,
          packingMaterial:
            product.packagingMaterial?.packagingMaterialName || null,
          packagingMaterialUoM: product.packagingMaterialUoM?.unit || null,
          packagingMaterialAmount: product.packagingMaterialAmount,
          packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
          packagingMaterialQuantity: product.packagingMaterialQuantity,
          packagingMaterialTotalWeight: product.packagingMaterialTotalWeight,
        }),
      ),
    };

    return formattedChallan;
  }
  async getByIdChallanforUpdate(id: string): Promise<any> {
    const challan = await this.challanRepository
      .createQueryBuilder('challan')
      .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
      .leftJoinAndSelect('products.productName', 'productName')
      .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
      .leftJoinAndSelect(
        'products.packagingMaterialUoM',
        'packagingMaterialUoM',
      )
      .leftJoinAndSelect('products.saleUoM', 'saleUoM')
      .leftJoinAndSelect('challan.partyName', 'partyName')
      .leftJoinAndSelect('challan.billingAddress', 'billingAddress')
      .leftJoinAndSelect('challan.deliveryAddress', 'deliveryAddress')
      .leftJoinAndSelect('challan.companyName', 'company')
      .leftJoinAndSelect('challan.offices', 'office')
      .leftJoinAndSelect('challan.grnNo', 'grn')
      .leftJoinAndSelect('challan.toLocationInput', 'toLocationInput')
      .leftJoinAndSelect('challan.fromLocationInput', 'fromLocationInput')
      .where('challan.id = :id', { id })
      .getOne();

    if (!challan) {
      return null;
    }

    const { createdDate, createdTime } = formatDateTime(challan.createdAt);

    const formattedChallan = {
      id: challan.id,
      challanNo: challan.challanNo,

      companyName: challan.companyName?.id || null,
      office: challan.offices?.id || null,
      grnNo: challan.grnNo?.id || null,
      fromLocationInput: challan.fromLocationInput
        ? {
            id: challan.fromLocationInput.id,
            address1: challan.fromLocationInput.address1,
            address2: challan.fromLocationInput.address2,
            city: challan.fromLocationInput.city,
            state: challan.fromLocationInput.state,
            location: challan.fromLocationInput.location,
            pincode: challan.fromLocationInput.pincode,
          }
        : null,
      toLocationInput: challan.toLocationInput
        ? {
            id: challan.toLocationInput.id,
            address1: challan.toLocationInput.address1,
            address2: challan.toLocationInput.address2,
            city: challan.toLocationInput.city,
            state: challan.toLocationInput.state,
            location: challan.toLocationInput.location,
            pincode: challan.toLocationInput.pincode,
          }
        : null,
      driverName: challan.driverName,
      contactNo: challan.contactNo,
      altContactNo: challan.altContactNo,
      vehicleNo: challan.vehicleNo,
      licenseNo: challan.licenseNo,
      receiverName: challan.receiverName,
      totalProductAmount: challan.totalProductAmount,
      netProductWeight: challan.netProductWeight,
      netPackagingMaterialWeight: challan.netPackagingMaterialWeight,
      totalPackagingMaterialAmount: challan.totalPackagingMaterialAmount,
      totalAmtInWords: challan.totalAmtInWords,
      createdDate,
      createdTime,
      requestingDepartment: challan.requestingDepartment,
      approvalStatus: challan.approvalStatus,
      remark: challan.remark,
      anyAttachment: challan.anyAttachment,
      deliveryChallanProducts: challan.deliveryChallanProducts.map(
        (product) => ({
          id: product.id,
          productName: product.productName?.id,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          amount: product.amount,
          saleUoM: product.saleUoM?.id || null,
          packingMaterial: product.packagingMaterial?.id || null,
          packagingMaterialUoM: product.packagingMaterialUoM?.id || null,
          packagingMaterialAmount: product.packagingMaterialAmount,
          packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
          packagingMaterialQuantity: product.packagingMaterialQuantity,
          packagingMaterialTotalWeight: product.packagingMaterialTotalWeight,
        }),
      ),
    };

    return formattedChallan;
  }
  async getAll(queryOptions: PaginationOptions): Promise<any> {
    const queryBuilder = this.challanRepository
      .createQueryBuilder('challan')
      .leftJoinAndSelect('challan.deliveryChallanProducts', 'products')
      .leftJoinAndSelect('products.productName', 'productName')
      .leftJoinAndSelect('products.packagingMaterial', 'packagingMaterial')
      .leftJoinAndSelect(
        'products.packagingMaterialUoM',
        'packagingMaterialUoM',
      )
      .leftJoinAndSelect('products.saleUoM', 'saleUoM')
      .leftJoinAndSelect('challan.companyName', 'company')
      .leftJoinAndSelect('challan.offices', 'office')
      .leftJoinAndSelect('challan.grnNo', 'grn')
      .leftJoinAndSelect('challan.toLocationInput', 'toLocationInput')
      .leftJoinAndSelect('challan.fromLocationInput', 'fromLocationInput');

    const result = await buildQuery(queryBuilder, queryOptions, 'challan');

    return {
      data: result.data.map((challan) => {
        const { createdDate, createdTime } = formatDateTime(challan.createdAt);
        return {
          id: challan.id,
          challanNo: challan.challanNo,
          companyName: challan.companyName?.name || null,
          office: challan.offices?.name || null,
          grnNo: challan.grnNo?.grnNo || null,
          //   fromLocationInput: challan.fromLocationInput?.name || null,
          fromLocationInput: challan.fromLocationInput
            ? {
                id: challan.fromLocationInput.id,
                address1: challan.fromLocationInput.address1,
                address2: challan.fromLocationInput.address2,
                city: challan.fromLocationInput.city,
                state: challan.fromLocationInput.state,
                location: challan.fromLocationInput.location,
                pincode: challan.fromLocationInput.pincode,
              }
            : null,
          toLocationInput: challan.toLocationInput
            ? {
                id: challan.toLocationInput.id,
                address1: challan.toLocationInput.address1,
                address2: challan.toLocationInput.address2,
                city: challan.toLocationInput.city,
                state: challan.toLocationInput.state,
                location: challan.toLocationInput.location,
                pincode: challan.toLocationInput.pincode,
              }
            : null,

          driverName: challan.driverName,
          contactNo: challan.contactNo,
          altContactNo: challan.altContactNo,
          vehicleNo: challan.vehicleNo,
          licenseNo: challan.licenseNo,
          receiverName: challan.receiverName,
          totalProductAmount: challan.totalProductAmount,
          netProductWeight: challan.netProductWeight,
          netPackagingMaterialWeight: challan.netPackagingMaterialWeight,
          totalPackagingMaterialAmount: challan.totalPackagingMaterialAmount,
          totalAmtInWords: challan.totalAmtInWords,
          createdDate,
          createdTime,
          requestingDepartment: challan.requestingDepartment,
          approvalStatus: challan.approvalStatus,
          remark: challan.remark,
          anyAttachment: challan.anyAttachment,
          deliveryChallanProducts: challan.deliveryChallanProducts.map(
            (product) => ({
              id: product.id,
              productName: product.productName?.name,
              quantity: product.quantity,
              unitPrice: product.unitPrice,
              amount: product.amount,
              saleUoM: product.saleUoM?.unit || null,
              packingMaterial:
                product.packagingMaterial?.packagingMaterialName || null,
              packagingMaterialUoM: product.packagingMaterialUoM?.unit || null,
              packagingMaterialAmount: product.packagingMaterialAmount,
              packagingMaterialUnitPrice: product.packagingMaterialUnitPrice,
              packagingMaterialQuantity: product.packagingMaterialQuantity,
              packagingMaterialTotalWeight:
                product.packagingMaterialTotalWeight,
            }),
          ),
        };
      }),
      meta: result.meta,
    };
  }

  async update(id: string, data: any): Promise<any> {
    try {
      const challan = await this.challanRepository.findOne({ where: { id } });
      if (!challan) return null;

      Object.assign(challan, data);
      return await this.challanRepository.save(challan);
    } catch (err) {
      logger.error(`Error updating other delivery challan with ID: ${id}`, {
        error: err,
      });
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.challanRepository.delete(id);
      return result.affected !== 0;
    } catch (err) {
      logger.error(`Error deleting other delivery challan with ID: ${id}`, {
        error: err,
      });
      return false;
    }
  }
}
