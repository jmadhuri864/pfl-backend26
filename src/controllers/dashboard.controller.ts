import { controller, httpGet, request, response } from "inversify-express-utils";
import { Request, Response } from "express";
import { inject } from "inversify";
import { TYPES } from "../types";

import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { DepartmentEnum } from "../entities/workflowClosure.entity";
import { Status } from "../entities/salesTarget.entity";
import { DashboardService } from "../services/dashboard.service";

@controller('/dashboard', deserializeUser, requireUser)
export class DashboardController {
    constructor(
        @inject(TYPES.DashboardService)
        private dashboardService: DashboardService
    ) { }

    //TODO:Get Procurement Team Performance 
    @httpGet('/midlevel/procurement/team-performance')
    async getProcurementTeamPerformance(
        @request() req: Request,
        @response() res: Response
    ) {
        const userId = res.locals.user.id;
        console.log("User ID in DashboardController:", userId);
        try {
            const data = await this.dashboardService.getProcurementTeamPerformance(userId);
            return res.status(200).json({
                success: true,
                data,
                message: "Procurement team performance data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get Sale Team Performance
    @httpGet('/midlevel/sale/team-performance')
    async getSaleTeamPerformance(
        @request() req: Request,
        @response() res: Response
    ) {
        const userId = res.locals.user?.id;
        try {
            const data = await this.dashboardService.getSaleTeamPerformance(userId);
            return res.status(200).json({
                success: true,
                data,
                message: "Sale team performance data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get Total Procurement Amt And Qty By Source Wise For Current Month
    @httpGet('/midlevel/procurement/source-wise')
    async getProcurementSourceWise(
        @request() req: Request,
        @response() res: Response
    ) {
        const userId = res.locals.user?.id;
        try {
            const data = await this.dashboardService.getProcurementSourceWise(userId);
            return res.status(200).json({
                success: true,
                data,
                message: "Procurement source-wise data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get Procurement Team Memebers Performance Overview in Deashboard
    @httpGet('/midlevel/procurement/team-members-performance')
    async getProcurementTeamMembersPerformance(
        @request() req: Request,
        @response() res: Response
    ) {
        const userId = res.locals.user.id;
        console.log("User ID in DashboardController:", userId);
        try {
            const data = await this.dashboardService.getProcurementTeamMembersPerformance(userId);
            return res.status(200).json({
                success: true,
                data,
                message: "Procurement team members performance data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get Sale Team Memebers Performance Overview in Deashboard
    @httpGet('/midlevel/sale/team-members-performance')
    async getSaleTeamMembersPerformance(
        @request() req: Request,
        @response() res: Response
    ) {
        const userId = res.locals.user.id;
        console.log("User ID in DashboardController:", userId);
        try {
            const data = await this.dashboardService.getSaleTeamMembersPerformance(userId);
            return res.status(200).json({
                success: true,
                data,
                message: "Sale team members performance data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
        }
    //TODO:Get Farmer Registration Overview of Team in Dashboard
      @httpGet("/registration-insight/farmer-registration")
    async getFarmerRegistrationOverviewOfTeam(
        @request() req: Request,
        @response() res: Response
    ) {
       const teamLeaderId = res.locals.user?.id as string;
        try {
            const data = await this.dashboardService.getFarmerRegistrationOverviewOfTeam(teamLeaderId);
            return res.status(200).json({
                success: true,
                data,
                message: "Farmer registration overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get Vendor Registration Overview of Team in Dashboard
      @httpGet("/registration-insight/vendor-registration")
    async getVendorRegistrationOverviewOfTeam(
        @request() req: Request,
        @response() res: Response
    ) {
       const teamLeaderId = res.locals.user?.id as string;
        try {
            const data = await this.dashboardService.getVendorRegistrationOverviewOfTeam(teamLeaderId);
            return res.status(200).json({
                success: true,
                data,
                message: "Vendor registration overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get Customer Registration Overview of Team in Dashboard
      @httpGet("/registration-insight/customer-registration/")
    async getCustomerRegistrationOverviewOfTeam(
        @request() req: Request,
        @response() res: Response
    ) {
       const teamLeaderId = res.locals.user?.id as string;
        try {
            const data = await this.dashboardService.getCustomerRegistrationOverviewOfTeam(teamLeaderId);
            return res.status(200).json({
                success: true,
                data,
                message: "Customer registration overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

     //TODO:Get Farmer Registration Overview of Each Team Member Of A Team in Dashboard
      @httpGet("/registration-insight/farmer-registration/team-members-performance")
    async getFarmerRegistrationOverviewOfEachTeamMember(
        @request() req: Request,
        @response() res: Response
    ) {
       const teamLeaderId = res.locals.user?.id as string;
        try {
            const data = await this.dashboardService.getFarmerRegistrationOverviewOfEachTeamMember(teamLeaderId);
            return res.status(200).json({
                success: true,
                data,
                message: "Farmer registration overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

     //TODO:Get Vendor Registration Overview of Each Team Member Of A Team in Dashboard
      @httpGet("/registration-insight/vendor-registration/team-members-performance")
    async getVendorRegistrationOverviewOfEachTeamMember(
        @request() req: Request,
        @response() res: Response
    ) {
       const teamLeaderId = res.locals.user?.id as string;
        try {
            const data = await this.dashboardService.getVendorRegistrationOverviewOfEachTeamMember(teamLeaderId);
            return res.status(200).json({
                success: true,
                data,
                message: "Vendor registration overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

     //TODO:Get Customer Registration Overview of Each Team Member Of A Team in Dashboard
      @httpGet("/registration-insight/customer-registration/team-members-performance")
    async getCustomerRegistrationOverviewOfEachTeamMember(
        @request() req: Request,
        @response() res: Response
    ) {
       const teamLeaderId = res.locals.user?.id as string;
        try {
            const data = await this.dashboardService.getCustomerRegistrationOverviewOfEachTeamMember(teamLeaderId);
            return res.status(200).json({
                success: true,
                data,
                message: "Customer registration overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    @httpGet("/employee-count/by-dept")
    public async getEmployeeCountByDept(
        @request() req: Request,
        @response() res: Response,
    ) {
        try {
            const { department } = req.query;
            const userId = res.locals.user?.id;

            const data = await this.dashboardService.getEmployeeCountByDept({ userId, department });
console.log(data);
            return res.status(200).json({
                success: true,
                message: userId
                    ? `Employee team stats for user ${userId}`
                    : "Global employee team stats",
                data,
            });
        } catch (error: any) {
            console.log(error);
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to fetch employee team stats",
            });
        }
    }
//TODO:Get Procurement Overview for all team in Dashboard
    @httpGet('/upper-level/procurement-overview')
    async getProcurementOverview(
        @request() req: Request,
        @response() res: Response
    ) {
        try {
            const data = await this.dashboardService.getProcurementOverview();
            return res.status(200).json({
                success: true,
                data,
                message: "Procurement overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

     //TODO:Get Sale Overview for all team in Dashboard
    @httpGet('/upper-level/sale-overview')
    async getSaleOverview(
        @request() req: Request,
        @response() res: Response
    ) {
        try {
            const data = await this.dashboardService.getSaleOverview();
            return res.status(200).json({
                success: true,
                data,
                message: "Sale overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get GRN Overview for all team in Dashboard
    @httpGet('/upper-level/grn-overview')
    async getGRNOverview(
        @request() req: Request,
        @response() res: Response
    ) {
        try {
            const data = await this.dashboardService.getGRNOverview();
            return res.status(200).json({
                success: true,
                data,
                message: "GRN overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get Invoice Overview for all team in Dashboard
    @httpGet('/upper-level/invoice-overview')
    async getInvoiceOverview(
        @request() req: Request,
        @response() res: Response
    ) {
        try {
            const data = await this.dashboardService.getInvoiceOverview();
            return res.status(200).json({
                success: true,
                data,
                message: "Invoice overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get sale overview by customer type wise in Dashboard
    @httpGet('/upper-level/customer-type-wise/sale-overview')
    async getCustomerTypeWiseSaleOverview(
        @request() req: Request,
        @response() res: Response
    ) {
        try {
            const data = await this.dashboardService.getCustomerTypeWiseSaleOverview();
            return res.status(200).json({
                success: true,
                data,
                message: "Customer type wise sale overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get sale overview by customer category wise in Dashboard
    @httpGet('/upper-level/customer-category-wise/sale-overview')
    async getCustomerCategoryWiseSaleOverview(
        @request() req: Request,
        @response() res: Response
    ) {
        try {
            const data = await this.dashboardService.getCustomerCategoryWiseSaleOverview();
            return res.status(200).json({
                success: true,
                data,
                message: "Customer Category wise sale overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get Procurement Overview by vendor category wise in Dashboard
    @httpGet('/upper-level/vendor-category-wise/procurement-overview')
    async getVendorCategoryWiseProcurementOverview(
        @request() req: Request,
        @response() res: Response
    ) {
        try {
            const data = await this.dashboardService.getVendorCategoryWiseProcurementOverview();
            return res.status(200).json({
                success: true,
                data,
                message: "Vendor Category wise procurement overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

        //TODO:Get Procurement Overview by vendor subcategory wise in Dashboard
    @httpGet('/upper-level/vendor-subcategory-wise/procurement-overview')
    async getVendorSubcategoryWiseProcurementOverview(
        @request() req: Request,
        @response() res: Response
    ) {
        try {
            const data = await this.dashboardService.getVendorSubcategoryWiseProcurementOverview();
            return res.status(200).json({
                success: true,
                data,
                message: "Vendor Subcategory wise procurement overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //TODO:Get Location Wise sale overview in Dashboard (Sale Distribution by location)
    @httpGet('/upper-level/location-wise/sale-distribution')
    async getLocationWiseSaleOverview(
        @request() req: Request,
        @response() res: Response
    ) {
        try {
            const data = await this.dashboardService.getLocationWiseSaleOverview();
            return res.status(200).json({
                success: true,
                data,
                message: "Location wise sale overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

        //TODO:Get Location Wise procurement overview in Dashboard (Procurement Distribution by location)
    @httpGet('/upper-level/location-wise/procurement-distribution')
    async getLocationWiseProcurementOverview(
        @request() req: Request,
        @response() res: Response
    ) {
        try {
            const data = await this.dashboardService.getLocationWiseProcurementOverview();
            return res.status(200).json({
                success: true,
                data,
                message: "Location wise procurement overview data retrieved successfully"
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    //Top 5 customer
    @httpGet("/top5/customer")
    public async getTop5Customer(
        @request() req: Request,
        @response() res: Response,
    ) {
        try {
            const { teamLeaderId } = req.query;

            const data = await this.dashboardService.getTop5Customer({ teamLeaderId });

            return res.status(200).json({
                success: true,
                message: teamLeaderId
                    ? `Top 5 customers for team leader`
                    : "Global top 5 customers",
                data,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to fetch top 5 customers",
            });
        }
    }

    // Top 5 farmers
    @httpGet("/top5/farmer")
    public async getTop5Farmer(
        @request() req: Request,
        @response() res: Response,
    ) {
        try {
            const { teamLeaderId } = req.query;

            const data = await this.dashboardService.getTop5Farmer({ teamLeaderId });

            return res.status(200).json({
                success: true,
                message: teamLeaderId
                    ? `Top 5 farmers for team leader`
                    : "Global top 5 farmers",
                data,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to fetch top 5 farmers",
            });
        }
    }

    // Top 5 vendors
    @httpGet("/top5/vendor")
    public async getTop5Vendor(
        @request() req: Request,
        @response() res: Response,
    ) {
        try {
            const { teamLeaderId } = req.query;

            const data = await this.dashboardService.getTop5Vendor({ teamLeaderId });

            return res.status(200).json({
                success: true,
                message: teamLeaderId
                    ? `Top 5 vendors for team leader`
                    : "Global top 5 vendors",
                data,
            });
        } catch (error: any) {
            return res.status(500).json({
                success: false,
                message: error.message || "Failed to fetch top 5 vendors",
            });
        }
    }

}