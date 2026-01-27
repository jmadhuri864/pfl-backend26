// import { inject } from "inversify";

// import { TYPES } from "../types";
// import { controller, httpGet, next ,request,response} from "inversify-express-utils";
// import { deserializeUser, requireUser } from "../middleware/deserializeUser";
// import { NextFunction,Request,Response} from "express";
// import { RegistrationReportService } from "../services/registrationReport.service";

// @controller('/registration-report',deserializeUser,requireUser)
// export class RegistrationReportController {
//     constructor(@inject(TYPES.RegistrationReportService) private registrationReportService: RegistrationReportService) {}


//     //TODO:Get registration report for vendors
//     @httpGet('/counts/vendor')
//     public async getRegistrationReportForVendor(@request() req: Request,
//           @response() res: Response,
//           @next() next: NextFunction) {
//         try {
//             // Get employeeIds from query params (can be string or array)
//             const { employeeIds } = req.query;
            
//             if (!employeeIds) {
//                 return res.status(400).json({ 
//                     message: "employeeIds is required as query parameter" 
//                 });
//             }

//             // Convert to array - handles both single value and multiple values
//             let employeeIdsArray: string[] = [];
            
//             if (Array.isArray(employeeIds)) {
//                 // Multiple employeeIds: ?employeeIds=emp1&employeeIds=emp2
//                 employeeIdsArray = employeeIds
//                     .filter(id => typeof id === 'string')
//                     .map(id => (id as string).trim())
//                     .filter(id => id.length > 0);
//             } else if (typeof employeeIds === 'string') {
//                 // Single employeeId: ?employeeIds=emp1
//                 if (employeeIds.trim().length > 0) {
//                     employeeIdsArray = [employeeIds.trim()];
//                 }
//             }

//             if (employeeIdsArray.length === 0) {
//                 return res.status(400).json({ 
//                     message: "At least one valid employeeId is required" 
//                 });
//             }

//             // Call the service method to get the report
//             const report = await this.registrationReportService.getVendorRegistrationReport(employeeIdsArray);
//             return res.status(200).json(report);
            
//         } catch (error) {
//             next(error);
//         }
//     }

//     //TODO:Get registration report for Farmers
//     @httpGet('/counts/farmer')
//     public async getRegistrationReportForFarmer(@request() req: Request,
//           @response() res: Response,
//           @next() next: NextFunction) {
//         try {
//             // Get employeeIds from query params (can be string or array)
//             const { employeeIds } = req.query;
            
//             if (!employeeIds) {
//                 return res.status(400).json({ 
//                     message: "employeeIds is required as query parameter" 
//                 });
//             }

//             // Convert to array - handles both single value and multiple values
//             let employeeIdsArray: string[] = [];
            
//             if (Array.isArray(employeeIds)) {
//                 // Multiple employeeIds: ?employeeIds=emp1&employeeIds=emp2
//                 employeeIdsArray = employeeIds
//                     .filter(id => typeof id === 'string')
//                     .map(id => (id as string).trim())
//                     .filter(id => id.length > 0);
//             } else if (typeof employeeIds === 'string') {
//                 // Single employeeId: ?employeeIds=emp1
//                 if (employeeIds.trim().length > 0) {
//                     employeeIdsArray = [employeeIds.trim()];
//                 }
//             }

//             if (employeeIdsArray.length === 0) {
//                 return res.status(400).json({ 
//                     message: "At least one valid employeeId is required" 
//                 });
//             }

//             // Call the service method to get the report
//             const report = await this.registrationReportService.getFarmerRegistrationReport(employeeIdsArray);
//             return res.status(200).json(report);
            
//         } catch (error) {
//             next(error);
//         }
//     }

//     //TODO:Get registration report for Customers
//     @httpGet('/counts/customer')
//     public async getRegistrationReportForCustomer(@request() req: Request,
//           @response() res: Response,
//           @next() next: NextFunction) {
//         try {
//             // Get employeeIds from query params (can be string or array)
//             const { employeeIds } = req.query;
            
//             if (!employeeIds) {
//                 return res.status(400).json({ 
//                     message: "employeeIds is required as query parameter" 
//                 });
//             }

//             // Convert to array - handles both single value and multiple values
//             let employeeIdsArray: string[] = [];
            
//             if (Array.isArray(employeeIds)) {
//                 // Multiple employeeIds: ?employeeIds=emp1&employeeIds=emp2
//                 employeeIdsArray = employeeIds
//                     .filter(id => typeof id === 'string')
//                     .map(id => (id as string).trim())
//                     .filter(id => id.length > 0);
//             } else if (typeof employeeIds === 'string') {
//                 // Single employeeId: ?employeeIds=emp1
//                 if (employeeIds.trim().length > 0) {
//                     employeeIdsArray = [employeeIds.trim()];
//                 }
//             }

//             if (employeeIdsArray.length === 0) {
//                 return res.status(400).json({ 
//                     message: "At least one valid employeeId is required" 
//                 });
//             }

//             // Call the service method to get the report
//             const report = await this.registrationReportService.getCustomerRegistrationReport(employeeIdsArray);
//             return res.status(200).json(report);
            
//         } catch (error) {
//             next(error);
//         }
//     }

//     //TODO: Generate Excel report for all registrations
//     @httpGet('/export/excel')
//     public async generateExcelReport(@request() req: Request,
//           @response() res: Response,
//           @next() next: NextFunction) {
//         try {
//             // Get employeeIds from query params (can be string or array)
//             const { employeeIds } = req.query;
            
//             if (!employeeIds) {
//                 return res.status(400).json({ 
//                     message: "employeeIds is required as query parameter" 
//                 });
//             }

//             // Convert to array - handles both single value and multiple values
//             let employeeIdsArray: string[] = [];
            
//             if (Array.isArray(employeeIds)) {
//                 // Multiple employeeIds: ?employeeIds=emp1&employeeIds=emp2
//                 employeeIdsArray = employeeIds
//                     .filter(id => typeof id === 'string')
//                     .map(id => (id as string).trim())
//                     .filter(id => id.length > 0);
//             } else if (typeof employeeIds === 'string') {
//                 // Single employeeId: ?employeeIds=emp1
//                 if (employeeIds.trim().length > 0) {
//                     employeeIdsArray = [employeeIds.trim()];
//                 }
//             }

//             if (employeeIdsArray.length === 0) {
//                 return res.status(400).json({ 
//                     message: "At least one valid employeeId is required" 
//                 });
//             }

//             console.log('Generating Excel report for employees:', employeeIdsArray);

//             // Generate Excel report - returns buffer directly
//             const { buffer, fileName } = await this.registrationReportService.generateRegistrationExcelReport(employeeIdsArray);

//             console.log('Excel report generated:', fileName);
//             console.log('Buffer size:', buffer.length, 'bytes');

//             // Set headers for file download
//             res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//             res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
//             res.setHeader('Content-Length', buffer.length);
//             res.setHeader('Cache-Control', 'no-cache');

//             // Send buffer directly
//             res.send(buffer);
            
//         } catch (error: any) {
//             console.error('Error generating Excel report:', error);
//             // Only send error response if headers haven't been sent yet
//             if (!res.headersSent) {
//                 res.status(500).json({ 
//                     message: 'Error generating Excel report',
//                     error: error.message 
//                 });
//             }
//         }
//     }
// }