
import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from '../utils/data-source';
import { Company } from '../entities/company.entity';
import { BankDetails } from '../entities/bankDetailsCompany.entity';

export async function seedDatabase() {
    try {
        console.log('Checking for existing company data...');

        const companyRepo = AppDataSource.getRepository(Company);
        const bankRepo = AppDataSource.getRepository(BankDetails);

        const existingCompany = await companyRepo.count();
        
        if (existingCompany > 0) {
            console.log('Database already has company data. Skipping seeding.');
            return;
        }

        console.log('No existing data found. Seeding database...');

        // Read JSON file
        const filePath = path.join(__dirname, '..', 'data', 'company.json');
       const jsonData = fs.readFileSync(filePath, 'utf-8');
        const companies = JSON.parse(jsonData);

        for (const companyData of companies) {
            const company = companyRepo.create({
                name: companyData.name,
                gstNo: companyData.gstNo,
                fassaiNo: companyData.fassaiNo,
                bankDetails: []
            });

            await companyRepo.save(company);

            for (const bank of companyData.bankDetails) {
                const newBankDetail = bankRepo.create({
                    accountNo: bank.accountNo,
                    bankName: bank.bankName,
                    branch: bank.branch,
                    ifscCode: bank.ifscCode,
                    company: company
                });

                await bankRepo.save(newBankDetail);
            }
        }

        console.log('Seeding completed successfully!');
    } catch (error) {
        console.error('Error while seeding database:', error);
    }
}


