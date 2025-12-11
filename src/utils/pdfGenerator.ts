import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import ejs from 'ejs';
import { injectable } from 'inversify';
import path from 'path';
import puppeteer from 'puppeteer';
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
    this.bucketName = process.env.BUCKET_NAME!;

    this.s3Client = new S3Client({
      region: process.env.REGION!,
      credentials: {
        accessKeyId: process.env.ACCESS_KEY!,
        secretAccessKey: process.env.ACCESS_SECRET!,
      },
      forcePathStyle: true, // only needed if using MinIO/LocalStack
    });
  }

  
 
  async generatePdfFromTemplate(templateName: string, data: any, s3Key: string): Promise<string> {
    try {
      console.log({data})
      const templatePath = path.join(__dirname, `../templates/${templateName}.ejs`);

      
      const html = await ejs.renderFile(templatePath, { data });

      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ],
        timeout: 60000
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
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
      console.log('Starting PDF generation...');
      
      // Render HTML from EJS Template
      const templatePath = path.join(__dirname, '../templates/invoiceTemplate.ejs');
      console.log('Template path:', templatePath);
      
      const html = await ejs.renderFile(templatePath, { data });
      console.log('HTML rendered successfully');

      // Generate PDF using Puppeteer with Windows-friendly settings
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ],
        timeout: 60000
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = Buffer.from(await page.pdf({ format: 'A4' }));
      await browser.close();
      console.log('PDF generated successfully, size:', pdfBuffer.length);

      const fileName = `invoices/invoice_${Date.now()}.pdf`;

      // Check if we should use S3 or local storage
      if (this.bucketName && process.env.ACCESS_KEY && process.env.ACCESS_SECRET) {
        try {
          // Upload to S3
          const s3Params = {
            Bucket: this.bucketName,
            Key: fileName,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
          };

          console.log('Uploading to S3 with params:', { Bucket: s3Params.Bucket, Key: s3Params.Key });
          await this.s3Client.send(new PutObjectCommand(s3Params));
          console.log('Upload successful');

          // Return the S3 file URL
          return `https://${this.bucketName}.s3.${process.env.REGION}.amazonaws.com/${fileName}`;
        } catch (s3Error) {
          console.error('S3 upload failed, falling back to local storage:', s3Error);
          // Fall through to local storage
        }
      }

      // Fallback: Save locally
      const fs = require('fs');
      const localDir = path.join(__dirname, '../../uploads/invoices');
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }

      const localPath = path.join(localDir, `invoice_${Date.now()}.pdf`);
      fs.writeFileSync(localPath, pdfBuffer);
      console.log('PDF saved locally at:', localPath);

      // Return local file path (you may want to serve this via express static)
      return `/uploads/${fileName}`;
    } catch (error) {
      console.error('Error generating or uploading PDF:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  }
}
