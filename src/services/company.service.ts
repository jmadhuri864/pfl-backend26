import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { CompanyRepository } from "../repositories/company.repository";


@injectable()
export class CompanyService {
    constructor(
        @inject(TYPES.CompanyRepository)private readonly companyRepository: CompanyRepository,
    ){}


    async createCompany(companyData: any): Promise<any> {
        const company = this.companyRepository.create(companyData);
        return await this.companyRepository.save(company);
    }

    async getCompanyById(id: string): Promise<any> {
        return this.companyRepository.findOne({
            where: { id },
            relations: ["bankDetails"],
        });
    }

    async getAllCompanies(): Promise<any> {
        const result = await this.companyRepository.find({
          relations: ["bankDetails"],
        });
      
        // Filter/transform the data here
        return result.map((company) => ({
          id: company.id,
          name: company.name,
          gstNo: company.gstNo,
         officeAddress:company.officeAddress,
          fassaiNo: company.fassaiNo,
          logo: company.logo,
          bankDetails: company.bankDetails?.map((bank) => ({
            id:bank.id,
            bankName: bank.bankName,
            accountNo: bank.accountNo,
            ifscCode: bank.ifscCode,
            branch: bank.branch,
          })),
        }));
      }
      

    async getAllforupdateCompanies(): Promise<any> {
        return this.companyRepository.find({ relations: ["bankDetails"] });
    }


    async getPartialCompanyDeatils(): Promise<any> {
        return this.companyRepository.find({
            select: ["id", "name"],
        });
    }
}