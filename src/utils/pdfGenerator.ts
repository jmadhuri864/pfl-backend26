import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import ejs from 'ejs';
import { injectable } from 'inversify';
import path from 'path';
import puppeteer from 'puppeteer';
import { Readable } from 'stream';
@injectable()
export class PdfGeneratorService {
  private s3Client: S3Client;
  private bucketName: string;

  // constructor() {
  //   this.s3Client = new S3Client({
  //     credentials: {
  //       accessKeyId: process.env.ACCESS_KEY!,
  //       secretAccessKey: process.env.ACCESS_SECRET!,
  //     },
  //     region: process.env.REGION!,
  //   });
  //   this.bucketName = process.env.BUCKET_NAME!;
  // }

   constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME!;

    this.s3Client = new S3Client({
      region: process.env.REGION!,
      credentials: {
        accessKeyId: process.env.ACCESS_KEY!,
        secretAccessKey: process.env.ACCESS_SECRET!,
      },
      forcePathStyle: true, // only needed if using MinIO/LocalStack
    });

    // ✅ Remove checksum middleware to avoid crc64 error
    
  }

  
 
  async generatePdfFromTemplate(templateName: string, data: any, s3Key: string): Promise<string> {
    try {
      console.log({data})
      const templatePath = path.join(__dirname, `../templates/${templateName}.ejs`);

      
      const html = await ejs.renderFile(templatePath, { data });

      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html);
      const pdfBuffer = await page.pdf({ format: 'A4' });
      await browser.close();

      const s3Params = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: Buffer.from(pdfBuffer),
        ContentType: 'application/pdf',
      };

      await this.s3Client.send(new PutObjectCommand(s3Params));

      return `https://${this.bucketName}.s3.${process.env.REGION}.amazonaws.com/${s3Key}`;
    } catch (error) {
      console.error('PDF generation/upload failed:', error);
      throw new Error('Failed to generate or upload PDF');
    }
  }
async getExcelFromS3(key: string): Promise<Buffer> {
  this.s3Client.middlewareStack.remove("flexibleChecksumsMiddleware");
    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
       //ChecksumMode: "DISABLED",
    });
//console.log("cpommandddddd",command)
    const response = await this.s3Client.send(command);
//console.log("responssssse",response)
    if (!response.Body) {
      throw new Error("No file content found in S3 response");
    }

    // ✅ Directly convert to byte array
    const bytes = await response.Body.transformToByteArray();

    return Buffer.from(bytes);
  }


async generateInvoicePdf(data: any): Promise<string> {
    try {
      // Render HTML from EJS Template
      const templatePath = path.join(__dirname, '../templates/invoiceTemplate.ejs');
      const html = await ejs.renderFile(templatePath, { data });

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html);
      const pdfBuffer = Buffer.from(await page.pdf({ format: 'A4' }));
      await browser.close();

      // Upload to S3
      const fileName = `invoices/invoice.pdf`;
      const s3Params = {
        Bucket: this.bucketName,
        Key: fileName,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      };

      await this.s3Client.send(new PutObjectCommand(s3Params));

      // Return the S3 file URL
      return `https://${this.bucketName}.s3.${process.env.REGION}.amazonaws.com/${fileName}`;
    } catch (error) {
      console.error('Error generating or uploading PDF:', error);
      throw new Error('Failed to generate or upload PDF');
    }
  }
}
