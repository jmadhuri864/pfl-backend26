import { controller, httpGet, request, response } from "inversify-express-utils";
import { Request, Response } from "express";
import { inject } from "inversify";
import { TYPES } from "../types";

import { deserializeUser, requireUser } from "../middleware/deserializeUser";
import { DepartmentEnum } from "../entities/workflowClosure.entity";
import { Status } from "../entities/salesTarget.entity";

@controller('/dashboard', deserializeUser, requireUser)
export class DashboardController {
    // constructor(
    //     @inject(TYPES.DashboardService)
    //     private dashboardService: DashboardService
    // ) {}

    // // 📊 EXECUTIVE DASHBOARD
    // @httpGet('/executive')
    // async getExecutiveDashboard(
    //     @request() req: Request,
    //     @response() res: Response
    // ) {
    //     try {
    //         const userId = res.locals.user?.id;
            
    //         if (!userId) {
    //             return res.status(401).json({
    //                 success: false,
    //                 message: "User not authenticated"
    //             });
    //         }

    //         const { startDate, endDate, department } = req.query;
            
    //         const filters: any = {};
    //         if (startDate) filters.startDate = new Date(startDate as string);
    //         if (endDate) filters.endDate = new Date(endDate as string);
    //         if (department) filters.department = department as DepartmentEnum;

    //         const data = await this.dashboardService.getExecutiveDashboard(userId, filters);

    //         return res.status(200).json({
    //             success: true,
    //             data,
    //             message: "Executive dashboard data retrieved successfully"
    //         });

    //     } catch (error: any) {
    //         return res.status(500).json({
    //             success: false,
    //             message: error.message
    //         });
    //     }
    // }

    // // 📈 SALES PERFORMANCE DASHBOARD
    // @httpGet('/sales-performance')
    // async getSalesPerformanceDashboard(
    //     @request() req: Request,
    //     @response() res: Response
    // ) {
    //     try {
    //         const userId = res.locals.user?.id;
            
    //         if (!userId) {
    //             return res.status(401).json({
    //                 success: false,
    //                 message: "User not authenticated"
    //             });
    //         }

    //         const { startDate, endDate, employeeId, customerId, productId } = req.query;
            
    //         const filters: any = {};
    //         if (startDate) filters.startDate = new Date(startDate as string);
    //         if (endDate) filters.endDate = new Date(endDate as string);
    //         if (employeeId) filters.employeeId = employeeId as string;
    //         if (customerId) filters.customerId = customerId as string;
    //         if (productId) filters.productId = productId as string;

    //         const data = await this.dashboardService.getSalesPerformanceDashboard(userId, filters);

    //         return res.status(200).json({
    //             success: true,
    //             data,
    //             message: "Sales performance dashboard data retrieved successfully"
    //         });

    //     } catch (error: any) {
    //         return res.status(500).json({
    //             success: false,
    //             message: error.message
    //         });
    //     }
    // }

    // // 🏢 WORKFLOW HIERARCHY DASHBOARD
    // @httpGet('/workflow-hierarchy')
    // async getWorkflowHierarchyDashboard(
    //     @request() req: Request,
    //     @response() res: Response
    // ) {
    //     try {
    //         const userId = res.locals.user?.id;
            
    //         if (!userId) {
    //             return res.status(401).json({
    //                 success: false,
    //                 message: "User not authenticated"
    //             });
    //         }

    //         const data = await this.dashboardService.getWorkflowHierarchyDashboard(userId);

    //         return res.status(200).json({
    //             success: true,
    //             data,
    //             message: "Workflow hierarchy dashboard data retrieved successfully"
    //         });

    //     } catch (error: any) {
    //         return res.status(500).json({
    //             success: false,
    //             message: error.message
    //         });
    //     }
    // }

    // // 📋 MONTHLY PLAN ANALYTICS
    // @httpGet('/monthly-plan-analytics')
    // async getMonthlyPlanAnalytics(
    //     @request() req: Request,
    //     @response() res: Response
    // ) {
    //     try {
    //         const userId = res.locals.user?.id;
            
    //         if (!userId) {
    //             return res.status(401).json({
    //                 success: false,
    //                 message: "User not authenticated"
    //             });
    //         }

    //         const { startDate, endDate, department, status } = req.query;
            
    //         const filters: any = {};
    //         if (startDate) filters.startDate = new Date(startDate as string);
    //         if (endDate) filters.endDate = new Date(endDate as string);
    //         if (department) filters.department = department as DepartmentEnum;
    //         if (status) filters.status = status as Status;

    //         const data = await this.dashboardService.getMonthlyPlanAnalytics(userId, filters);

    //         return res.status(200).json({
    //             success: true,
    //             data,
    //             message: "Monthly plan analytics retrieved successfully"
    //         });

    //     } catch (error: any) {
    //         return res.status(500).json({
    //             success: false,
    //             message: error.message
    //         });
    //     }
    // }

    // // 📊 QUICK STATS (for widgets)
    // @httpGet('/quick-stats')
    // async getQuickStats(
    //     @request() req: Request,
    //     @response() res: Response
    // ) {
    //     try {
    //         const userId = res.locals.user?.id;
            
    //         if (!userId) {
    //             return res.status(401).json({
    //                 success: false,
    //                 message: "User not authenticated"
    //             });
    //         }

    //         // Get current month data
    //         const now = new Date();
    //         const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    //         const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    //         const filters = {
    //             startDate: startOfMonth,
    //             endDate: endOfMonth
    //         };

    //         const executiveData = await this.dashboardService.getExecutiveDashboard(userId, filters);
    //         const hierarchyData = await this.dashboardService.getWorkflowHierarchyDashboard(userId);

    //         const quickStats = {
    //             totalPlans: executiveData.overallStats.totalPlans,
    //             approvedPlans: executiveData.overallStats.approvedPlans,
    //             //achievementRate: executiveData.overallStats.achievementRate,
    //             teamSize: hierarchyData.totalTeamSize,
    //             directReports: hierarchyData.totalDirectReports,
    //             totalTargetAmount: executiveData.overallStats.totalTargetAmount,
    //             totalAchievedAmount: executiveData.overallStats.totalAchievedAmount,
    //             activeEmployees: executiveData.overallStats.activeEmployees
    //         };

    //         return res.status(200).json({
    //             success: true,
    //             data: quickStats,
    //             message: "Quick stats retrieved successfully"
    //         });

    //     } catch (error: any) {
    //         return res.status(500).json({
    //             success: false,
    //             message: error.message
    //         });
    //     }
    // }

    // // 📈 PERFORMANCE TRENDS
    // @httpGet('/performance-trends')
    // async getPerformanceTrends(
    //     @request() req: Request,
    //     @response() res: Response
    // ) {
    //     try {
    //         const userId = res.locals.user?.id;
            
    //         if (!userId) {
    //             return res.status(401).json({
    //                 success: false,
    //                 message: "User not authenticated"
    //             });
    //         }

    //         const { period = '6months', type = 'monthly' } = req.query;
            
    //         // Calculate date range based on period
    //         const now = new Date();
    //         let startDate: Date;
            
    //         switch (period) {
    //             case '3months':
    //                 startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    //                 break;
    //             case '6months':
    //                 startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    //                 break;
    //             case '1year':
    //                 startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    //                 break;
    //             default:
    //                 startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    //         }

    //         const filters = { startDate, endDate: now };
    //         const data = await this.dashboardService.getExecutiveDashboard(userId, filters);

    //         return res.status(200).json({
    //             success: true,
    //             data: {
    //                 trends: data.trends,
    //                 period,
    //                 type
    //             },
    //             message: "Performance trends retrieved successfully"
    //         });

    //     } catch (error: any) {
    //         return res.status(500).json({
    //             success: false,
    //             message: error.message
    //         });
    //     }
    // }

    // // 🎯 TOP PERFORMERS
    // @httpGet('/top-performers')
    // async getTopPerformers(
    //     @request() req: Request,
    //     @response() res: Response
    // ) {
    //     try {
    //         const userId = res.locals.user?.id;
            
    //         if (!userId) {
    //             return res.status(401).json({
    //                 success: false,
    //                 message: "User not authenticated"
    //             });
    //         }

    //         const { limit = '10', period = 'current_month' } = req.query;
            
    //         // Calculate date range
    //         const now = new Date();
    //         let startDate: Date, endDate: Date;
            
    //         switch (period) {
    //             case 'current_month':
    //                 startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    //                 endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    //                 break;
    //             case 'last_month':
    //                 startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    //                 endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    //                 break;
    //             case 'quarter':
    //                 const quarter = Math.floor(now.getMonth() / 3);
    //                 startDate = new Date(now.getFullYear(), quarter * 3, 1);
    //                 endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
    //                 break;
    //             default:
    //                 startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    //                 endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    //         }

    //         const filters = { startDate, endDate };
    //         const data = await this.dashboardService.getExecutiveDashboard(userId, filters);

    //         return res.status(200).json({
    //             success: true,
    //             data: {
    //                 topPerformers: data.topPerformers.slice(0, parseInt(limit as string)),
    //                 period,
    //                 totalCount: data.topPerformers.length
    //             },
    //             message: "Top performers retrieved successfully"
    //         });

    //     } catch (error: any) {
    //         return res.status(500).json({
    //             success: false,
    //             message: error.message
    //         });
    //     }
    // }

    // // 📊 DEPARTMENT COMPARISON
    // @httpGet('/department-comparison')
    // async getDepartmentComparison(
    //     @request() req: Request,
    //     @response() res: Response
    // ) {
    //     try {
    //         const userId = res.locals.user?.id;
            
    //         if (!userId) {
    //             return res.status(401).json({
    //                 success: false,
    //                 message: "User not authenticated"
    //             });
    //         }

    //         const { startDate, endDate } = req.query;
            
    //         const filters: any = {};
    //         if (startDate) filters.startDate = new Date(startDate as string);
    //         if (endDate) filters.endDate = new Date(endDate as string);

    //         const data = await this.dashboardService.getExecutiveDashboard(userId, filters);

    //         return res.status(200).json({
    //             success: true,
    //             data: {
    //                 departmentPerformance: data.departmentPerformance,
    //                 filters
    //             },
    //             message: "Department comparison retrieved successfully"
    //         });

    //     } catch (error: any) {
    //         return res.status(500).json({
    //             success: false,
    //             message: error.message
    //         });
    //     }
    // }

    // // 📋 PLAN STATUS OVERVIEW
    // @httpGet('/plan-status-overview')
    // async getPlanStatusOverview(
    //     @request() req: Request,
    //     @response() res: Response
    // ) {
    //     try {
    //         const userId = res.locals.user?.id;
            
    //         if (!userId) {
    //             return res.status(401).json({
    //                 success: false,
    //                 message: "User not authenticated"
    //             });
    //         }

    //         const { startDate, endDate } = req.query;
            
    //         const filters: any = {};
    //         if (startDate) filters.startDate = new Date(startDate as string);
    //         if (endDate) filters.endDate = new Date(endDate as string);

    //         const data = await this.dashboardService.getExecutiveDashboard(userId, filters);

    //         return res.status(200).json({
    //             success: true,
    //             data: {
    //                 planStatusDistribution: data.planStatusDistribution,
    //                 overallStats: data.overallStats,
    //                 filters
    //             },
    //             message: "Plan status overview retrieved successfully"
    //         });

    //     } catch (error: any) {
    //         return res.status(500).json({
    //             success: false,
    //             message: error.message
    //         });
    //     }
    // }
}