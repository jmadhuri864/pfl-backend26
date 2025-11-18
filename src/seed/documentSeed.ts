
import * as fs from 'fs';
import * as path from 'path';
import { AppDataSource } from '../utils/data-source';

import { DocumentDefinition } from '../entities/documentdef.entity';

export async function seedDocumentDefDatabase() {
    try {
        console.log('Checking for existing documentDefination data...');

        const documentRepo = AppDataSource.getRepository(DocumentDefinition);
       

        const existingDocument= await documentRepo.count();
        
        if (existingDocument > 0) {
            console.log('Database already has docuemntDefination data. Skipping seeding.');
            return;
        }

        console.log('No existing data found. Seeding database...');

        // Read JSON file
        const filePath = path.join(__dirname, '..', 'data', 'documentDefination.json');
       const jsonData = fs.readFileSync(filePath, 'utf-8');
        const companies = JSON.parse(jsonData);

        for (const companyData of companies) {
            const company = documentRepo.create({
                uniqueKey: companyData.uniqueKey,
                name: companyData.name,
                documentType: companyData.documentType,
               
            });

            await documentRepo.save(company);

            
        }

        console.log('Seeding completed successfully!');
    } catch (error) {
        console.error('Error while seeding database:', error);
    }
}


