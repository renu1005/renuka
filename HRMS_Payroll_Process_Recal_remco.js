/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 * @NModuleScope Public
 */

var HEADER_FIELDS = {
    EMP_TYPE: "custrecord_njt_hr_prp_emp_type",
    PAY_PERIOD: "custrecord_njt_hr_prp_pay_period",
    CHECKBOX: "custrecord_njt_hr_prp_recal"
}

var PAYROLL_SUBLIST = {
    TYPE: "recmachcustrecord_njt_hr_ppd_link",
    EMP: "custrecord_njt_hr_ppd_emp_id"
}


var RECORD, SEARCH, MOMENT, FORMAT, QUERY, TASK, record_obj;
define(['N/record', 'N/search', './moment', 'N/format', 'N/query', 'N/task', './dts_config_enum.js'], function (record, search, moment, format, query, task, dtsEnum) {
    RECORD = record;
    SEARCH = search;
    MOMENT = moment;
    FORMAT = format;
    QUERY = query;
    TASK = task;

    function afterSubmit(context) {
        try {
            var rec_id = context.newRecord.id;
            var rec_type = context.newRecord.type;


            record_obj = RECORD.load({
                type: rec_type,
                id: rec_id
            });
            var GetStatus = record_obj.getValue(HEADER_FIELDS.CHECKBOX);
            if (GetStatus == true) {
                var totalNetAmountValue = 0;
                var EmployeeType = record_obj.getValue(HEADER_FIELDS.EMP_TYPE); //Employee type from current record
                var PayPeriod = record_obj.getValue(HEADER_FIELDS.PAY_PERIOD); //Pay period from current record
                var GetPay_month = record_obj.getText(HEADER_FIELDS.PAY_PERIOD); //Get text values from payperiod for loan and cash.

                var Employee_InternalId = [] //Line data stored in this array
                var Monthly_Sheet_Array = [] //Line data stored in this array
                var Salary_Details = [] // Employee salary details
                var Loan_Advance = [] //Loan and cash details stored
                var Addition_Deduction = [] //Payroll and deduction values stored
                var Frame_Data = []; //Frame data for sublist


                /*******START******************Get the payelement data****************************************************/
                var Addition_Fields = [];
                var Deduction_Fields = [];
                // Date: 20210904 Note - Do not show Leave encashment and Leave settlement pay elements. We use other fields to bind those values.
                var Pay_elementSearchObj = search.create({
                    type: "customrecordpay_element",
                    filters: [
                        ["isinactive", "is", "F"],
                        "AND", ["internalid", "noneof", String(dtsEnum.PAYROLL_PROCESS.LEAVE_SETTLEMENT_PAY_ELEMENT)]
                    ],
                    columns: [
                        search.createColumn({
                            name: "internalid",
                            label: "Internal ID"
                        }),
                        search.createColumn({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "Name"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pe_code",
                            label: "Pay Element Code"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pe_description",
                            label: "Description"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pe_type",
                            label: "Type"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pe_element_sequence",
                            label: "Element Sequence"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pe_id_mapping_addition",
                            label: "ID Mapping(Addition)"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pe_id_mapping_deductio",
                            label: "ID Mapping(Deduction)"
                        })
                    ]
                });
                var payElementsearchResultCount = Pay_elementSearchObj.runPaged().count;
                if (payElementsearchResultCount > 0) {
                    Pay_elementSearchObj.run().each(function (result) {
                        var PayElement_Type = result.getValue({
                            name: "custrecord_njt_hr_pe_type",
                            label: "Type"
                        });
                        var PayElement_Id = result.getValue({
                            name: "internalid",
                            label: "Internal ID"
                        });
                        var PayElement_Code = result.getValue({
                            name: "name",
                            sort: search.Sort.ASC,
                            label: "Name"
                        });
                        var PayElement_Seq = result.getText({
                            name: "custrecord_njt_hr_pe_element_sequence",
                            label: "Element Sequence"
                        });
                        var PayElement_Addition = result.getText({
                            name: "custrecord_njt_hr_pe_id_mapping_addition",
                            label: "ID Mapping(Addition)"
                        });
                        var PayElement_Deduction = result.getText({
                            name: "custrecord_njt_hr_pe_id_mapping_deductio",
                            label: "ID Mapping(Deduction)"
                        });
                        if (PayElement_Type == 1) {
                            Addition_Fields.push({
                                "PEID": PayElement_Id,
                                "PEC": PayElement_Code,
                                "PES": PayElement_Seq,
                                "PEA": PayElement_Addition
                            })

                        } else if (PayElement_Type == 2) {
                            Deduction_Fields.push({
                                "PEID": PayElement_Id,
                                "PEC": PayElement_Code,
                                "PES": PayElement_Seq,
                                "PED": PayElement_Deduction
                            })
                        } else {
                            //nothing done here
                        }

                        return true;
                    });
                }
                log.debug('Addition_Fields', JSON.stringify(Addition_Fields));
                log.debug('Deduction_Fields', JSON.stringify(Deduction_Fields));
                /*******END******************Get the payelement data****************************************************/

                var Monthlyattendance_SearchObj = search.create({
                    type: "customrecord_monthlyattendance_",
                    filters: [
                        ["custrecord_njt_hr_mas_pay_period", "anyof", PayPeriod],
                        "AND", ["custrecord_njt_hr_mas_emp_type", "anyof", EmployeeType]
                    ],
                    columns: [
                        search.createColumn({
                            name: "custrecord_njt_hr_mas_emp_type",
                            label: "Employee Type"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_mas_pay_period",
                            label: "Pay Period"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_mas_no_of_warking_days",
                            label: "No Of Working Days"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_emp_id",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Employee ID"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_total_days",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Total Days"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_total_worked_days",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Total Worked Days"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_payable_days",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Payable Days"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_al_days",
                            join: "custrecord_njt_hr_masc_link",
                            label: "AL Days"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_week_off",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Weekoff"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_holidays",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Holidays"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_emp_dept",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Emp Department"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_emp_design",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Emp Designation"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_late_in_case_1",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Late In - Case 1"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_late_in_case_2",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Late In - Case 2"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_late_in_case_3",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Late In - Case 3"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_late_in_case_4",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Late In - Case 4"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_early_out_case_1",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Early Out - Case 1"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_early_out_case_2",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Early Out - Case 2"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_early_out_case_3",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Early Out - Case 3"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_early_out_case_4",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Early Out - Case 4"
                        }),
                        search.createColumn({
                            name: "custrecordnjt_hr_masc_total_late_in_hrs",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Total Late In Hours"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_total_e_out_hrs",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Total Early Out Hrs"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_normal_ot_hours",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Normal OT Hours"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_weekoff_ot_hours",
                            join: "custrecord_njt_hr_masc_link",
                            label: "WeekOff OT Hours"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_holiday_ot_hours",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Holiday OT Hours"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_masc_total_ot_hours",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Total OT Hours"
                        })
                    ]
                });
                var MASSearchResultCount = Monthlyattendance_SearchObj.runPaged().count;
                //log.debug("Monthlyattendance_SearchObj result count",MASSearchResultCount);
                // Saravana 20210218 checking of monthly sheet availability
                if (MASSearchResultCount <= 0) {
                    log.debug("No monthly sheet created");
                    return;
                }
                //// log.debug("Monthlyattendance_SearchObj",JSON.stringify(Monthlyattendance_SearchObj));
                if (MASSearchResultCount > 0) {


                    Monthlyattendance_SearchObj.run().each(function (result) {
                        var GetEmp_Value = result.getValue({
                            name: "custrecord_njt_hr_masc_emp_id",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Employee ID"
                        });
                        var Get_total_days = result.getValue({
                            name: "custrecord_njt_hr_masc_total_days",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Total Days"
                        });
                        var Get_twd = result.getValue({
                            name: "custrecord_njt_hr_masc_total_worked_days",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Total Worked Days"
                        });
                        var Get_paidDays = result.getValue({
                            name: "custrecord_njt_hr_masc_payable_days",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Payable Days"
                        });
                        var annualLeaveDays = result.getValue({
                            name: "custrecord_njt_hr_masc_al_days",
                            join: "custrecord_njt_hr_masc_link",
                            label: "AL Days"
                        });
                        var weekoffforthemonth = result.getValue({
                            name: "custrecord_njt_hr_masc_week_off",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Weekoff"
                        });
                        var holidaysforthemonth = result.getValue({
                            name: "custrecord_njt_hr_masc_holidays",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Holidays"
                        });
                        var empTypeValue = result.getValue({
                            name: "custrecord_njt_hr_mas_emp_type",
                            label: "Employee Type"
                        });
                        var empDesignValue = result.getValue({
                            name: "custrecord_njt_hr_masc_emp_design",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Emp Designation"
                        }) || ' ';
                        var empDepartmentValue = result.getValue({
                            name: "custrecord_njt_hr_masc_emp_dept",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Emp Department"
                        }) || ' ';
                        var totalLateInCase1 = result.getValue({
                            name: "custrecord_njt_hr_masc_late_in_case_1",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Late In - Case 1"
                        }) || 0;
                        var totalLateInCase2 = result.getValue({
                            name: "custrecord_njt_hr_masc_late_in_case_2",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Late In - Case 2"
                        }) || 0;
                        var totalLateInCase3 = result.getValue({
                            name: "custrecord_njt_hr_masc_late_in_case_3",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Late In - Case 3"
                        }) || 0;
                        var totalLateInCase4 = result.getValue({
                            name: "custrecord_njt_hr_masc_late_in_case_4",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Late In - Case 4"
                        }) || 0;
                        var totalEarlyOutCase1 = result.getValue({
                            name: "custrecord_njt_hr_masc_early_out_case_1",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Early Out - Case 1"
                        }) || 0;
                        var totalEarlyOutCase2 = result.getValue({
                            name: "custrecord_njt_hr_masc_early_out_case_2",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Early Out - Case 2"
                        }) || 0;
                        var totalEarlyOutCase3 = result.getValue({
                            name: "custrecord_njt_hr_masc_early_out_case_3",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Early Out - Case 3"
                        }) || 0;
                        var totalEarlyOutCase4 = result.getValue({
                            name: "custrecord_njt_hr_masc_early_out_case_4",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Early Out - Case 4"
                        }) || 0;
                        var totalLateInHrs = result.getValue({
                            name: "custrecordnjt_hr_masc_total_late_in_hrs",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Total Late In Hours"
                        }) || '';
                        var totalEarlyOutHrs = result.getValue({
                            name: "custrecord_njt_hr_masc_total_e_out_hrs",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Total Early Out Hrs"
                        }) || '';
                        var totalWeekDayOTHrs = result.getValue({
                            name: "custrecord_njt_hr_masc_normal_ot_hours",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Normal OT Hours"
                        }) || '';
                        var totalWeekOffOTHrs = result.getValue({
                            name: "custrecord_njt_hr_masc_weekoff_ot_hours",
                            join: "custrecord_njt_hr_masc_link",
                            label: "WeekOff OT Hours"
                        }) || '';
                        var totalHolidayOTHrs = result.getValue({
                            name: "custrecord_njt_hr_masc_holiday_ot_hours",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Holiday OT Hours"
                        }) || '';
                        var totalTotalOTHrs = result.getValue({
                            name: "custrecord_njt_hr_masc_total_ot_hours",
                            join: "custrecord_njt_hr_masc_link",
                            label: "Total OT Hours"
                        }) || '';
                        if (GetEmp_Value == 4878) {
                            log.debug("Combined Result", {
                                "GetEmp_Value": GetEmp_Value,
                                "empDepartmentValue": empDepartmentValue
                            });
                        }
                        var totalworkingdaysforthemonth = Get_total_days - weekoffforthemonth - holidaysforthemonth;
                        //   // log.debug("GetEmp_Value",GetEmp_Value);
                        if (GetEmp_Value) {
                            Employee_InternalId.push(GetEmp_Value);
                            Monthly_Sheet_Array.push({
                                'Employee': GetEmp_Value,
                                'TWD': Get_twd,
                                'Total_days': Get_total_days,
                                'PaidDays': Get_paidDays,
                                'annualLeaveDays': annualLeaveDays,
                                'monthworkingdays': totalworkingdaysforthemonth,
                                'empdesign': empDesignValue,
                                'empdept': empDepartmentValue,
                                'totalLateInCase1': totalLateInCase1,
                                'totalLateInCase2': totalLateInCase2,
                                'totalLateInCase3': totalLateInCase3,
                                'totalLateInCase4': totalLateInCase4,
                                'totalEarlyOutCase1': totalEarlyOutCase1,
                                'totalEarlyOutCase2': totalEarlyOutCase2,
                                'totalEarlyOutCase3': totalEarlyOutCase3,
                                'totalEarlyOutCase4': totalEarlyOutCase4,
                                'totalLateInHrs': totalLateInHrs,
                                'totalEarlyOutHrs': totalEarlyOutHrs,
                                'totalWeekDayOTHrs': totalWeekDayOTHrs,
                                'totalWeekOffOTHrs': totalWeekOffOTHrs,
                                'totalHolidayOTHrs': totalHolidayOTHrs,
                                'totalTotalOTHrs': totalTotalOTHrs
                            });
                        } //GetEmp_Value block
                        return true;
                    });
                }
                log.debug("Monthly_Sheet_Array", JSON.stringify(Monthly_Sheet_Array));

                log.debug('Salary Details from the employee master', 'starts');
                /*******START***************Get Salary Details from the employee master**********************************************************/
                var EmployeeSearchObj = search.create({
                    type: "employee",
                    filters: [
                        ["isinactive", "is", "F"],
                        "AND", ["internalid", "anyof", Employee_InternalId]
                    ],
                    columns: [
                        search.createColumn({
                            name: "internalid",
                            label: "Internal ID"
                        }),
                        search.createColumn({
                            name: "entityid",
                            sort: search.Sort.ASC,
                            label: "Name"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_esd_code",
                            join: "custrecord_njt_hr_esd_link",
                            label: "Code"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_esd_amount",
                            join: "custrecord_njt_hr_esd_link",
                            label: "Amount"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_esd_fixed",
                            join: "custrecord_njt_hr_esd_link",
                            label: "Fixed"
                        }),
                        search.createColumn({
                            name: "custentity_njt_total_salary",
                            label: "Total Salary"
                        })
                    ]
                });
                var empSearchResultCount = EmployeeSearchObj.runPaged().count;
                if (empSearchResultCount > 0) {
                    EmployeeSearchObj.run().each(function (result) {
                        Salary_Details.push({
                            'Emp_Id': result.getValue({
                                name: "internalid",
                                label: "Internal ID"
                            }),
                            'CodeLabel': result.getText({
                                name: "custrecord_njt_hr_esd_code",
                                join: "custrecord_njt_hr_esd_link",
                                label: "Code"
                            }),
                            'Code': result.getValue({
                                name: "custrecord_njt_hr_esd_code",
                                join: "custrecord_njt_hr_esd_link",
                                label: "Code"
                            }),
                            'Amount': result.getValue({
                                name: "custrecord_njt_hr_esd_amount",
                                join: "custrecord_njt_hr_esd_link",
                                label: "Amount"
                            }),
                            'Fixed': result.getValue({
                                name: "custrecord_njt_hr_esd_fixed",
                                join: "custrecord_njt_hr_esd_link",
                                label: "Amount"
                            }),
                            'GrossSalary': result.getValue({
                                name: "custentity_njt_total_salary",
                                label: "Total Salary"
                            }) || 0
                        })
                        return true;
                    });
                }
                log.debug('Salary_Details', JSON.stringify(Salary_Details));
                /*******END***************Get Salary Details from the employee master*************************************************************/

                /*******START***************Get Loan and Cash Details*****************************************************************************/

                var Split_ = GetPay_month.split("-");
                var Month = Split_[0];
                var year = Split_[1];
                var Loan_advanceSearchObj = search.create({
                    type: "customrecord_lcadvance",
                    filters: [
                        ["custrecord_njt_hr_lr_emp_id", "anyof", Employee_InternalId],
                        "AND", ["custrecord_njt_hr_lr_status", "anyof", "1"],
                        "AND", ["custrecord1529.custrecord1530", "startswith", Month],
                        "AND", ["custrecord1529.custrecord1531", "startswith", year]
                    ],
                    columns: [
                        search.createColumn({
                            name: "custrecord_njt_hr_lr_emp_id",
                            label: "Employee ID"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_lr_amount_per_month",
                            label: "Amount/Month"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pe_code",
                            join: "custrecord_njt_hr_lr_pay_element",
                            label: "Pay Element Code"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pe_element_sequence",
                            join: "custrecord_njt_hr_lr_pay_element",
                            label: "Element Sequence"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pe_id_mapping_addition",
                            join: "custrecord_njt_hr_lr_pay_element",
                            label: "ID Mapping(Addition)"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pe_id_mapping_deductio",
                            join: "custrecord_njt_hr_lr_pay_element",
                            label: "ID Mapping(Deduction)"
                        })
                    ]
                });
                var loanAndCashsearchResultCount = Loan_advanceSearchObj.runPaged().count;
                if (loanAndCashsearchResultCount > 0) {
                    Loan_advanceSearchObj.run().each(function (result) {
                        Loan_Advance.push({
                            'Loan_Emp': result.getValue({
                                name: "custrecord_njt_hr_lr_emp_id",
                                label: "Employee ID"
                            }),
                            'Loan_Amount': result.getValue({
                                name: "custrecord_njt_hr_lr_amount_per_month",
                                label: "Amount/Month"
                            }),
                            'Pay_Element_Code': result.getValue({
                                name: "custrecord_njt_hr_pe_code",
                                join: "custrecord_njt_hr_lr_pay_element",
                                label: "Pay Element Code"
                            }),
                            'Deduction': result.getText({
                                name: "custrecord_njt_hr_pe_id_mapping_deductio",
                                join: "custrecord_njt_hr_lr_pay_element",
                                label: "ID Mapping(Deduction)"
                            })
                        })
                        return true;
                    });
                }

                log.debug("Loan_Advance", JSON.stringify(Loan_Advance));
                /*******END***************Get Loan and Cash Details*****************************************************************************/


                /*******START***************Get Addition and Deduction**************************************************************************/

                var Payroll_addition_deduction_SearchObj = search.create({
                    type: "customrecord_payroll_addition_deduction_",
                    filters: [
                        ["custrecord_njt_hr_pad_pay_period", "anyof", PayPeriod],
                        "AND", ["custrecord_njt_hr_pads_link.custrecord_njt_hr_pads_emp_id", "anyof", Employee_InternalId]
                    ],
                    columns: [
                        search.createColumn({
                            name: "custrecord_njt_hr_pads_emp_id",
                            join: "custrecord_njt_hr_pads_link",
                            label: "Employee ID"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pads_pay_element_code",
                            join: "custrecord_njt_hr_pads_link",
                            label: "PayElement Code"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pads_type",
                            join: "custrecord_njt_hr_pads_link",
                            label: "Type"
                        }),
                        search.createColumn({
                            name: "custrecord_njt_hr_pads_amount",
                            join: "custrecord_njt_hr_pads_link",
                            label: "Amount"
                        })
                    ]
                });
                var payrollADsearchResultCount = Payroll_addition_deduction_SearchObj.runPaged().count;
                Payroll_addition_deduction_SearchObj.run().each(function (result) {
                    Addition_Deduction.push({
                        'Addition_Emp_ID': result.getValue({
                            name: "custrecord_njt_hr_pads_emp_id",
                            join: "custrecord_njt_hr_pads_link",
                            label: "Employee ID"
                        }),
                        'PayElementCode_Label': result.getText({
                            name: "custrecord_njt_hr_pads_pay_element_code",
                            join: "custrecord_njt_hr_pads_link",
                            label: "PayElement Code"
                        }),
                        'PayElementCode': result.getValue({
                            name: "custrecord_njt_hr_pads_pay_element_code",
                            join: "custrecord_njt_hr_pads_link",
                            label: "PayElement Code"
                        }),
                        'Addition_Type': result.getValue({
                            name: "custrecord_njt_hr_pads_type",
                            join: "custrecord_njt_hr_pads_link",
                            label: "Type"
                        }),
                        'Addition_Amount': result.getValue({
                            name: "custrecord_njt_hr_pads_amount",
                            join: "custrecord_njt_hr_pads_link",
                            label: "Amount"
                        })
                    })
                    return true;
                });


                /*******END*****************Get Addition and Deduction**************************************************************************/
                var GetLeaveSettlement = FindLeaveSettlement(PayPeriod);
                // log.debug("GetLeaveSettlement", JSON.stringify(GetLeaveSettlement));

                // Date: 20210904 Note - Get Leave Encashment for this PayPeriod
                var GetLeaveEncashment = FindLeaveEncashment(PayPeriod);
                // log.debug("GetLeaveEncashment", JSON.stringify(GetLeaveEncashment));
                //log.debug("Salary_Details",JSON.stringify(Salary_Details));
                //log.debug("Loan_Advance",JSON.stringify(Loan_Advance));
                //log.debug("Addition_Deduction",JSON.stringify(Addition_Deduction));

                /*******START*****************Frame a data set to populate the values***********************************************************/

                log.debug("Monthly_Sheet_Array", JSON.stringify(Monthly_Sheet_Array));
                if (Monthly_Sheet_Array.length > 0) {
                    // Get all the Details
                    var otConfigMaster = getOTConfigDetails(1);
                    var bioSetup = getBiometricSetupDetails(1);
                    for (var m = 0; m < Monthly_Sheet_Array.length; m++) {
                        var Frame_list = {}
                        var Get_Employee = Monthly_Sheet_Array[m].Employee;
                        var Get_TWD = Monthly_Sheet_Array[m].TWD || 0;
                        var Get_PaidDays = Monthly_Sheet_Array[m].PaidDays || 0;
                        var Get_Total_Days = Monthly_Sheet_Array[m].Total_days || 0;
                        var annualLeaveDays = Monthly_Sheet_Array[m].annualLeaveDays || 0; // get the annual leave days from monthly attendance
                        var monthworkingdays = Monthly_Sheet_Array[m].monthworkingdays || 0;
                        var empDesignation = Monthly_Sheet_Array[m].empdesign || ' ';
                        var empDept = Monthly_Sheet_Array[m].empdept || ' ';
                        // Get all the Late In Details
                        var empTotalLateInCase1 = Monthly_Sheet_Array[m].totalLateInCase1 || 0;
                        var empTotalLateInCase2 = Monthly_Sheet_Array[m].totalLateInCase2 || 0;
                        var empTotalLateInCase3 = Monthly_Sheet_Array[m].totalLateInCase3 || 0;
                        var empTotalLateInCase4 = Monthly_Sheet_Array[m].totalLateInCase4 || 0;
                        var empTotalLateInHrs = Monthly_Sheet_Array[m].totalLateInHrs || '';
                        // Get all the Early Out Details
                        var empTotalEarlyOutCase1 = Monthly_Sheet_Array[m].totalEarlyOutCase1 || 0;
                        var empTotalEarlyOutCase2 = Monthly_Sheet_Array[m].totalEarlyOutCase2 || 0;
                        var empTotalEarlyOutCase3 = Monthly_Sheet_Array[m].totalEarlyOutCase3 || 0;
                        var empTotalEarlyOutCase4 = Monthly_Sheet_Array[m].totalEarlyOutCase4 || 0;
                        var empTotalEarlyOutHrs = Monthly_Sheet_Array[m].totalEarlyOutHrs || '';
                        // Get OT Details
                        var empTotalWeekDayOTHrs = Monthly_Sheet_Array[m].totalWeekDayOTHrs || '';
                        var empTotalWeekOffOTHrs = Monthly_Sheet_Array[m].totalWeekOffOTHrs || '';
                        var empTotalHolidayOTHrs = Monthly_Sheet_Array[m].totalHolidayOTHrs || '';
                        var empTotalOTHrs = Monthly_Sheet_Array[m].totalTotalOTHrs || '';



                        Frame_list["custrecord_njt_hr_ppd_emp_id"] = Get_Employee;
                        Frame_list["custrecord_njt_hr_ppd_twd"] = Get_TWD;
                        Frame_list["custrecord_njt_hr_ppd_paid_days"] = Get_PaidDays;
                        Frame_list["custrecord_njt_hr_ppd_designation"] = empDesignation;
                        Frame_list["custrecord_njt_hr_ppd_department"] = empDept;
                        if (Get_Employee) {

                            var addtion_total = 0;
                            var deduction_total = 0;
                            var Payroll_addition = 0;
                            var Payroll_Deduction = 0;
                            var loan_Deduction = 0;
                            var leaveSettlement = 0;
                            var leaveEncashment = 0;
                            // OT Calculation
                            var grossSalary = 0;
                            var basicSalary = 0;
                            var weekDayOTAddition = 0;
                            var weekOffOTAddition = 0;
                            var hoildayOTAddition = 0;
                            var totalOTAddition = 0;
                            // Deduction Details
                            var totalLateInDeduciton = 0;
                            var totalEarlyOutDeduciton = 0;

                            //GetLeaveSettlement
                            if (GetLeaveSettlement != null) {
                                var Result_LeaveSettlement = GetLeaveSettlement.filter(function (x) {
                                    if (x.Emp == Get_Employee) {
                                        return x;
                                    }
                                });
                                log.debug("Result_LeaveSettlement", JSON.stringify(Result_LeaveSettlement));
                                if (Result_LeaveSettlement && Result_LeaveSettlement.length > 0) {
                                    for (var k = 0; k < Result_LeaveSettlement.length; k++) {
                                        // isLeaveSettlementApplicable is removed. Becuase GJ does not Employee Transfer
                                        leaveSettlement += parseFloat(Result_LeaveSettlement[k].amount) || 0;
                                    }
                                }
                            }
                            // GetLeaveEncashment
                            if (GetLeaveEncashment != null) {
                                var leaveEncashmentResult = GetLeaveEncashment.filter(function (x) {
                                    if (x.Emp == Get_Employee) {
                                        return x;
                                    }
                                });
                                if (leaveEncashmentResult && leaveEncashmentResult.length > 0) {
                                    for (var k = 0; k < leaveEncashmentResult.length; k++) {
                                        // isLeaveSettlementApplicable is removed. Becuase GJ does not Employee Transfer
                                        leaveEncashment += parseFloat(leaveEncashmentResult[k].amount) || 0;
                                    }
                                }
                            }
                            addtion_total = addtion_total + leaveEncashment;
                            //Salary Details part calculation
                            var Result_Salary_Details = Salary_Details.filter(function (x) {
                                if (x.Emp_Id == Get_Employee) {
                                    return x;
                                }
                            })

                            if (Result_Salary_Details.length > 0) {
                                for (var r = 0; r < Result_Salary_Details.length; r++) {
                                    // log.debug("Result_Salary_Details", JSON.stringify(Result_Salary_Details[r]));
                                    var Get_Amount = Result_Salary_Details[r].Amount;
                                    var Get_Fixed = Result_Salary_Details[r].Fixed;
                                    var Get_Label = Result_Salary_Details[r].CodeLabel;
                                    var Get_Code = Result_Salary_Details[r].Code;
                                    //log.debug("Get_Code",JSON.stringify(Get_Code));
                                    // Set Gross Salary value here.
                                    grossSalary = Result_Salary_Details[r].GrossSalary;
                                    // Set Basisc Salary value here.
                                    if (Get_Code == dtsEnum.PAYROLL_PROCESS.BASIC_PAY_ELEMENT) {
                                        basicSalary = Get_Amount;
                                    }
                                    var Common, seq, id;
                                    // Date: 20210904 Note - Without setting NULL it takes previous Common value
                                    Common = null;
                                    // Date: 20210909 Note - Need to check Get_Code because some employees might not having any Salary Details.
                                    if (Get_Code) {
                                        Common = Addition_Fields.filter(function (x) {
                                            if (x.PEID == Get_Code) {
                                                return x;
                                            }
                                        });
                                        // log.debug('Common from Addition_Fields for ' + Get_Code, Common);
                                        if (Get_Code && Common.length > 0) {
                                            seq = Common[0].PES;
                                            id = Common[0].PEA;

                                        } else {
                                            Common = Deduction_Fields.filter(function (x) {
                                                if (x.PEID == Get_Code) {
                                                    return x;
                                                }
                                            });
                                            // log.debug('Common from Deduction_Fields for ' + Get_Code, Common);

                                            //log.debug("Common",JSON.stringify(Common));
                                            seq = Common[0].PES;
                                            id = Common[0].PED;
                                        }
                                    }



                                    //log.debug("Common",JSON.stringify(Common));
                                    if (Common) {
                                        //log.debug("seq",seq);
                                        //log.debug("Get_Amount",Get_Amount);
                                        //log.debug("Get_Total_Days",Get_Total_Days);
                                        //log.debug("Get_PaidDays",Get_PaidDays);

                                        var recId = "custrecord_njt_hr_ppd_";
                                        var Get_Element_Seq = seq;
                                        var lower = Get_Element_Seq.toLowerCase();
                                        var compose1 = recId + lower;
                                        var convert = Math.round(Get_Amount * 100) / 100;
                                        var Cal1 = convert / Get_Total_Days;
                                        //// log.debug("Cal1",Cal1);
                                        var Cal2 = 0;

                                        // Date: 20220218 Note - As per BRD Only Basic and HRA allowed for Annual Leave Days
                                        /* If Annual Leave > 0 and Pay element is NOT Basic /  HRA. Then deduct the 
                                        Annual Leave Days from Get_PaidDays. */
                                        if (annualLeaveDays > 0 && Get_Code != dtsEnum.PAYROLL_PROCESS.BASIC_PAY_ELEMENT && Get_Code != dtsEnum.PAYROLL_PROCESS.HRA_PAY_ELEMENT) {
                                            log.debug("Basic and HRA found", {
                                                "Cal1": Cal1,
                                                "AL": annualLeaveDays,
                                                "Get_PaidDays": Get_PaidDays
                                            });
                                            Cal2 = Cal1 * (Get_PaidDays - annualLeaveDays);
                                            log.debug("Cal2", Cal2);
                                        } else {
                                            Cal2 = Cal1 * Get_PaidDays;
                                        }

                                        //// log.debug("Cal2",Cal2);
                                        var convert_Cal2 = Math.round(Cal2 * 100) / 100;

                                        //log.debug("Cal2",Cal2);
                                        Frame_list[id] = convert;
                                        Frame_list[compose1] = convert_Cal2;
                                        addtion_total = addtion_total + convert_Cal2;
                                        if (Get_Employee == "1454") {
                                            // log.debug("Cal2/Cal2", Cal2);
                                            // log.debug("Cal2/addtion_total", addtion_total);
                                        }

                                    }

                                } // Sub For Loop


                                //Frame_list["Total_Addition"] = addtion_total;
                            }

                            //Loan and cash part calculation
                            var Result_Loan_Cash = Loan_Advance.filter(function (x) {
                                if (x.Loan_Emp == Get_Employee) {
                                    return x;
                                }
                            })
                            // log.debug("Result_Loan_Cash",JSON.stringify(Result_Loan_Cash));
                            if (Result_Loan_Cash.length > 0) {
                                for (var L = 0; L < Result_Loan_Cash.length; L++) {
                                    var Loan_Amount = Result_Loan_Cash[L].Loan_Amount;
                                    var id_Dec = Result_Loan_Cash[L].Deduction;
                                    //    // log.debug("id_Dec",id_Dec);
                                    var parseValue = parseFloat(Loan_Amount);
                                    var convert_LoanAmount = Math.round(parseValue * 100) / 100;
                                    loan_Deduction = loan_Deduction + convert_LoanAmount;
                                    //    // log.debug("loan_Deduction",loan_Deduction);
                                    Frame_list[id_Dec] = loan_Deduction;
                                }

                            }


                            //PayRoll Addition part calculation
                            var Result_PayRoll_Addition = Addition_Deduction.filter(function (x) {
                                if (x.Addition_Emp_ID == Get_Employee) {
                                    return x;
                                }
                            })
                            if (Result_PayRoll_Addition.length > 0) {
                                for (var L = 0; L < Result_PayRoll_Addition.length; L++) {
                                    var PayElementCode_Label = Result_PayRoll_Addition[L].PayElementCode_Label;
                                    var PayElementCode = Result_PayRoll_Addition[L].PayElementCode;
                                    var Addition_Type = Result_PayRoll_Addition[L].Addition_Type;
                                    var Addition_Amount = Result_PayRoll_Addition[L].Addition_Amount;
                                    var Parse_addition = parseFloat(Addition_Amount);
                                    var convert_addition = Math.round(Parse_addition * 100) / 100;
                                    var Common_, seq_, id_;
                                    if (PayElementCode && Addition_Type == 1) {
                                        Common_ = Addition_Fields.filter(function (x) {
                                            if (x.PEID == PayElementCode) {
                                                return x;
                                            }
                                        })
                                        //seq_ = Common_[0].PES;
                                        id_ = Common_[0].PEA;
                                        Payroll_addition = Payroll_addition + convert_addition;

                                    } else if (PayElementCode && Addition_Type == 2) {
                                        Common_ = Deduction_Fields.filter(function (x) {
                                            if (x.PEID == PayElementCode) {
                                                return x;
                                            }
                                        })
                                        // seq_ = Common_[0].PES;
                                        id_ = Common_[0].PED;
                                        Payroll_Deduction = Payroll_Deduction + convert_addition;
                                    }
                                    //    // log.debug("id_",id_);
                                    if (Common_) {
                                        //    // log.debug("Common_",Common_);
                                        Frame_list[id_] = Addition_Amount;
                                        //Frame_list[compose1] = Cal2;
                                    }
                                }
                                addtion_total = addtion_total + parseFloat(Payroll_addition);
                            }

                            // -------------------- OT Calculation Process Starts
                            var oneDayGrossSalary = parseFloat(grossSalary * 12 / 365);
                            var oneHourGrossSalary = parseFloat(oneDayGrossSalary / 8);
                            var oneHourBasicSalary = parseFloat(basicSalary * 12 / 365 / 8);

                            if (empTotalWeekDayOTHrs) {
                                var weekDayOTHrs = empTotalWeekDayOTHrs.split(":")[0];
                                weekDayOTAddition = oneHourGrossSalary * parseFloat(otConfigMaster.WeekDaySalaryFactor) * weekDayOTHrs;
                            }
                            if (empTotalWeekOffOTHrs) {
                                var weekOffOTHrs = empTotalWeekOffOTHrs.split(":")[0];
                                weekOffOTAddition = oneHourBasicSalary * parseFloat(otConfigMaster.WeekEndSalaryFactor) * weekOffOTHrs;
                            }
                            if (empTotalHolidayOTHrs) {
                                var weekHolidayOTHrs = empTotalHolidayOTHrs.split(":")[0];
                                hoildayOTAddition = oneHourGrossSalary * parseFloat(otConfigMaster.HolidaySalaryFactor) * weekHolidayOTHrs;
                            }

                            // Total  OT Addition
                            totalOTAddition = parseFloat(weekDayOTAddition) + parseFloat(weekOffOTAddition) + parseFloat(hoildayOTAddition);

                            // Binding Late and Early Hours Details
                            Frame_list["custrecord_njt_hr_ppd_late_in_hrs"] = empTotalLateInHrs;
                            Frame_list["custrecord_njt_hr_ppd_early_out_hrs"] = empTotalEarlyOutHrs;

                            // Binding OT Hours Details
                            Frame_list["custrecord_njt_hr_ppd_week_days_ot_hours"] = empTotalWeekDayOTHrs;
                            Frame_list["custrecord_njt_hr_ppd_week_days_ot_amoun"] = weekDayOTAddition.toFixed(2);
                            Frame_list["custrecord_njt_hr_ppd_week_off_ot_hours"] = empTotalWeekOffOTHrs;
                            Frame_list["custrecord_njt_hr_ppd_week_off_ot_amount"] = weekOffOTAddition.toFixed(2);
                            Frame_list["custrecord_njt_hr_ppd_ttl_holiday_ot_hrs"] = empTotalHolidayOTHrs;
                            Frame_list["custrecord_njt_hr_ppd_ttl_holiday_ot_amt"] = hoildayOTAddition.toFixed(2);
                            Frame_list["custrecord_njt_hr_ppd_total_ot_hours"] = empTotalOTHrs;
                            Frame_list["custrecord_njt_hr_ppd_total_ot_amount"] = totalOTAddition.toFixed(2);

                            // -------------------- Adding OT amount to Total Addition
                            addtion_total = addtion_total + parseFloat(totalOTAddition);

                            // -------------------- OT Calculation Process Ends

                            // -------------------- Biometric Deduction Process Starts

                            if (Get_Employee == 4976) {
                                log.debug("bioSetup", JSON.stringify(bioSetup));
                                log.debug("grossSalary", grossSalary);
                                log.debug("empTotalLateInCase1", empTotalLateInCase1);
                                log.debug("empTotalLateInCase2", empTotalLateInCase2);
                                log.debug("empTotalLateInCase3", empTotalLateInCase3);
                                log.debug("empTotalLateInCase4", empTotalLateInCase4);
                                log.debug("empTotalEarlyOutCase1", empTotalEarlyOutCase1);
                                log.debug("empTotalEarlyOutCase2", empTotalEarlyOutCase2);
                                log.debug("empTotalEarlyOutCase3", empTotalEarlyOutCase3);
                                log.debug("empTotalEarlyOutCase4", empTotalEarlyOutCase4);
                            }

                            // Late In
                            if (empTotalLateInCase1) {
                                var lateInCase1Factor = 0;
                                var lateInCase1Deduction = 0

                                var lateInCase1FirstFactor = Math.min(empTotalLateInCase1, 1);
                                var lateInCase1SecondFactor = Math.min(Math.max(empTotalLateInCase1 - 1, 0), 1);
                                var lateInCase1ThirdFactor = Math.min(Math.max(empTotalLateInCase1 - 2, 0), 1);
                                var lateInCase1ThirdAboveFactor = Math.max(Math.max(empTotalLateInCase1 - 3, 0), 0);

                                lateInCase1Factor = lateInCase1FirstFactor * parseFloat(bioSetup.lateInCase1_First) +
                                    lateInCase1SecondFactor * parseFloat(bioSetup.lateInCase1_Second) +
                                    lateInCase1ThirdFactor * parseFloat(bioSetup.lateInCase1_Third) +
                                    lateInCase1ThirdAboveFactor * parseFloat(bioSetup.lateInCase1_AboveThird);
                                //  Adding to Total Deduction.
                                lateInCase1Deduction = oneDayGrossSalary * parseFloat(lateInCase1Factor / 100);
                                totalLateInDeduciton = parseFloat(totalLateInDeduciton) + parseFloat(lateInCase1Deduction);
                            }
                            if (empTotalLateInCase2) {
                                var lateInCase2Factor = 0;
                                var lateInCase2Deduction = 0

                                var lateInCase2FirstFactor = Math.min(empTotalLateInCase2, 1);
                                var lateInCase2SecondFactor = Math.min(Math.max(empTotalLateInCase2 - 1, 0), 1);
                                var lateInCase2ThirdFactor = Math.min(Math.max(empTotalLateInCase2 - 2, 0), 1);
                                var lateInCase2ThirdAboveFactor = Math.max(Math.max(empTotalLateInCase2 - 3, 0), 0);

                                lateInCase2Factor = lateInCase2FirstFactor * parseFloat(bioSetup.lateInCase2_First) +
                                    lateInCase2SecondFactor * parseFloat(bioSetup.lateInCase2_Second) +
                                    lateInCase2ThirdFactor * parseFloat(bioSetup.lateInCase2_Third) +
                                    lateInCase2ThirdAboveFactor * parseFloat(bioSetup.lateInCase2_AboveThird);
                                //  Adding to Total Deduction.
                                lateInCase2Deduction = oneDayGrossSalary * parseFloat(lateInCase2Factor / 100);
                                totalLateInDeduciton = parseFloat(totalLateInDeduciton) + parseFloat(lateInCase2Deduction);
                            }
                            if (empTotalLateInCase3) {
                                var lateInCase3Factor = 0;
                                var lateInCase3Deduction = 0

                                var lateInCase3FirstFactor = Math.min(empTotalLateInCase3, 1);
                                var lateInCase3SecondFactor = Math.min(Math.max(empTotalLateInCase3 - 1, 0), 1);
                                var lateInCase3ThirdFactor = Math.min(Math.max(empTotalLateInCase3 - 2, 0), 1);
                                var lateInCase3ThirdAboveFactor = Math.max(Math.max(empTotalLateInCase3 - 3, 0), 0);

                                lateInCase3Factor = lateInCase3FirstFactor * parseFloat(bioSetup.lateInCase3_First) +
                                    lateInCase3SecondFactor * parseFloat(bioSetup.lateInCase3_Second) +
                                    lateInCase3ThirdFactor * parseFloat(bioSetup.lateInCase3_Third) +
                                    lateInCase3ThirdAboveFactor * parseFloat(bioSetup.lateInCase3_AboveThird);
                                //  Adding to Total Deduction.
                                lateInCase3Deduction = oneDayGrossSalary * parseFloat(lateInCase3Factor / 100);
                                totalLateInDeduciton = parseFloat(totalLateInDeduciton) + parseFloat(lateInCase3Deduction);
                            }
                            if (empTotalLateInCase4) {
                                // By default 100 %.
                                var lateInCase4Deduction = oneDayGrossSalary * empTotalLateInCase4;
                                //  Adding to Total Deduction.
                                totalLateInDeduciton = parseFloat(totalLateInDeduciton) + parseFloat(lateInCase4Deduction);
                            }

                            //  Early Out
                            if (empTotalEarlyOutCase1) {
                                var earlyOutCase1Factor = 0;
                                var earlyOutCase1Deduction = 0

                                var earlyOutCase1FirstFactor = Math.min(empTotalEarlyOutCase1, 1);
                                var earlyOutCase1SecondFactor = Math.min(Math.max(empTotalEarlyOutCase1 - 1, 0), 1);
                                var earlyOutCase1ThirdFactor = Math.min(Math.max(empTotalEarlyOutCase1 - 2, 0), 1);
                                var earlyOutCase1ThirdAboveFactor = Math.max(Math.max(empTotalEarlyOutCase1 - 3, 0), 0);

                                earlyOutCase1Factor = earlyOutCase1FirstFactor * parseFloat(bioSetup.earlyOutCase1_First) +
                                    earlyOutCase1SecondFactor * parseFloat(bioSetup.earlyOutCase1_Second) +
                                    earlyOutCase1ThirdFactor * parseFloat(bioSetup.earlyOutCase1_Third) +
                                    earlyOutCase1ThirdAboveFactor * parseFloat(bioSetup.earlyOutCase1_AboveThird);
                                //  Adding to Total Deduction.
                                earlyOutCase1Deduction = oneDayGrossSalary * parseFloat(earlyOutCase1Factor / 100);
                                totalEarlyOutDeduciton = parseFloat(totalEarlyOutDeduciton) + parseFloat(earlyOutCase1Deduction);
                            }
                            if (empTotalEarlyOutCase2) {
                                var earlyOutCase2Factor = 0;
                                var earlyOutCase2Deduction = 0

                                var earlyOutCase2FirstFactor = Math.min(empTotalEarlyOutCase2, 1);
                                var earlyOutCase2SecondFactor = Math.min(Math.max(empTotalEarlyOutCase2 - 1, 0), 1);
                                var earlyOutCase2ThirdFactor = Math.min(Math.max(empTotalEarlyOutCase2 - 2, 0), 1);
                                var earlyOutCase2ThirdAboveFactor = Math.max(Math.max(empTotalEarlyOutCase2 - 3, 0), 0);

                                earlyOutCase2Factor = earlyOutCase2FirstFactor * parseFloat(bioSetup.earlyOutCase2_First) +
                                    earlyOutCase2SecondFactor * parseFloat(bioSetup.earlyOutCase2_Second) +
                                    earlyOutCase2ThirdFactor * parseFloat(bioSetup.earlyOutCase2_Third) +
                                    earlyOutCase2ThirdAboveFactor * parseFloat(bioSetup.earlyOutCase2_AboveThird);
                                //  Adding to Total Deduction.
                                earlyOutCase2Deduction = oneDayGrossSalary * parseFloat(earlyOutCase2Factor / 100);
                                totalEarlyOutDeduciton = parseFloat(totalEarlyOutDeduciton) + parseFloat(earlyOutCase2Deduction);
                            }
                            if (empTotalEarlyOutCase3) {
                                var earlyOutCase3Factor = 0;
                                var earlyOutCase3Deduction = 0

                                var earlyOutCase3FirstFactor = Math.min(empTotalEarlyOutCase3, 1);
                                var earlyOutCase3SecondFactor = Math.min(Math.max(empTotalEarlyOutCase3 - 1, 0), 1);
                                var earlyOutCase3ThirdFactor = Math.min(Math.max(empTotalEarlyOutCase3 - 2, 0), 1);
                                var earlyOutCase3ThirdAboveFactor = Math.max(Math.max(empTotalEarlyOutCase3 - 3, 0), 0);

                                earlyOutCase3Factor = earlyOutCase3FirstFactor * parseFloat(bioSetup.earlyOutCase3_First) +
                                    earlyOutCase3SecondFactor * parseFloat(bioSetup.earlyOutCase3_Second) +
                                    earlyOutCase3ThirdFactor * parseFloat(bioSetup.earlyOutCase3_Third) +
                                    earlyOutCase3ThirdAboveFactor * parseFloat(bioSetup.earlyOutCase3_AboveThird);
                                //  Adding to Total Deduction.
                                earlyOutCase3Deduction = oneDayGrossSalary * parseFloat(earlyOutCase3Factor / 100);
                                totalEarlyOutDeduciton = parseFloat(totalEarlyOutDeduciton) + parseFloat(earlyOutCase3Deduction);
                            }
                            if (empTotalEarlyOutCase4) {
                                // By default 100 %.
                                var earlyOutCase4Deduction = oneDayGrossSalary * empTotalEarlyOutCase4;
                                //  Adding to Total Deduction.
                                totalEarlyOutDeduciton = parseFloat(totalEarlyOutDeduciton) + parseFloat(earlyOutCase4Deduction);
                            }

                            // Binding Late and Early Hours Details
                            Frame_list["custrecord_njt_hr_ppd_late_in_ded"] = Math.round(totalLateInDeduciton * 100) / 100;;
                            Frame_list["custrecord_njt_hr_ppd_early_out_ded"] = Math.round(totalEarlyOutDeduciton * 100) / 100;

                            // -------------------- Adding Biometric Deduction amount to Total deduction
                            deduction_total = deduction_total + parseFloat(totalLateInDeduciton) + parseFloat(totalEarlyOutDeduciton);


                            // -------------------- Biometric Deduction Process Ends

                            deduction_total = parseFloat(deduction_total) + parseFloat(loan_Deduction) + parseFloat(Payroll_Deduction);
                            // Date: 20210721 Note - Deduction total is not coming in deduction total. 
                            deduction_total = deduction_total + parseFloat(leaveSettlement);
                            var convert_addition_total = Math.round(addtion_total * 100) / 100;
                            var convert_deduction_total = Math.round(deduction_total * 100) / 100;
                            Frame_list["custrecord_ppd_leaveencashment_"] = parseFloat(leaveEncashment);
                            Frame_list["custrecord_ppd_leavesettlement_"] = parseFloat(leaveSettlement);
                            Frame_list["custrecord_njt_hr_ppd_addition"] = convert_addition_total;
                            Frame_list["custrecord_njt_hr_ppd_deduction"] = convert_deduction_total;
                            var Sum = parseFloat(convert_addition_total) - parseFloat(convert_deduction_total);
                            var convert_sum = Math.round(Sum * 100) / 100;
                            Frame_list["custrecord_njt_hr_ppd_net_amount"] = convert_sum;
                            var netAmountValue = FORMAT.parse({
                                value: Sum,
                                type: FORMAT.Type.CURRENCY
                            });
                            // // log.debug('netAmount', netAmount);
                            log.debug('netAmountValue', netAmountValue);
                            totalNetAmountValue += parseFloat(netAmountValue);
                            Frame_Data.push(Frame_list);
                        }
                    } //Main For Loop
                }

                log.debug("Frame_Data", JSON.stringify(Frame_Data));
                /*******END*****************Frame a data set to populate the values*************************************************************/
                if (Frame_Data.length > 0) {
                    while (record_obj.getLineCount(PAYROLL_SUBLIST.TYPE) > 0) {
                        record_obj.removeLine({
                            sublistId: PAYROLL_SUBLIST.TYPE,
                            line: 0
                        });
                    }


                    for (var i = 0; i < Frame_Data.length; i++) {

                        //record_obj.selectNewLine(PAYROLL_SUBLIST.TYPE);
                        for (var key in Frame_Data[i]) {
                            var key = key;
                            var val = Frame_Data[i][key] || 0;
                            //log.debug("key",key);
                            //log.debug("val",val);
                            record_obj.setSublistValue({
                                sublistId: PAYROLL_SUBLIST.TYPE,
                                fieldId: key,
                                line: i,
                                value: val
                            });
                        }
                        //record_obj.commitLine(PAYROLL_SUBLIST.TYPE);
                    }
                } //Frame_Data


                record_obj.setValue('custrecord_njt_hr_prp_recal', false);
                log.debug("totalNetAmountValue", totalNetAmountValue);
                var totalNetAmount = FORMAT.parse({
                    value: totalNetAmountValue,
                    type: FORMAT.Type.CURRENCY
                });
                log.debug("totalNetAmount", totalNetAmount);
                record_obj.setValue('custrecord_njt_hr_prp_total_net_amount', totalNetAmount);
                var recordId = record_obj.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: false
                });
                // Trigger the Map/Reduce script to update the Payroll Addition and Deduction line level status.
                var mrTask = TASK.create({
                    taskType: TASK.TaskType.MAP_REDUCE,
                    scriptId: 'customscript_njt_close_pad_mr'
                });
                var mrTaskId = mrTask.submit();
                log.audit("Payroll Process Updated. recordId: ", recordId);
            }
        } catch (e) {
            log.error('Error in afterSubmit', e);
            // throw e;
        }

    } // afterSubmit close block

    return {
        afterSubmit: afterSubmit
    }
});

function FindLeaveSettlement(payperiod) {
    try {
        var ArrayData = [];
        // Date: 20210904 Note - Only Get Leave Settlement Values by including Transaction Type filter.
        var customrecord_leve_setlmentSearchObj = SEARCH.create({
            type: "customrecord_leve_setlment",
            filters: [
                ["custrecord_njt_hr_ls_status", "anyof", "2"],
                "AND",
                ["custrecord_njt_hr_ls_trans_type", "IS", "1"],
                "AND",
                ["custrecord_njt_hr_ls_pay_period", "anyof", payperiod]
            ],
            columns: [
                SEARCH.createColumn({
                    name: "custrecord_njt_hr_ls_emp_id",
                    label: "Employee Id"
                }),
                SEARCH.createColumn({
                    name: "custrecord_njt_hr_ls_leave_appl_number",
                    label: "Leave Appl.Number"
                }),
                SEARCH.createColumn({
                    name: "custrecord_njt_hr_ls_amount_to_paid",
                    label: "Leave Settlement Amount"
                }),
                SEARCH.createColumn({
                    name: "custrecord_njt_hr_ls_approved_from_date",
                    label: "Approved From Date"
                })
            ]
        });
        var leaveSettlementsearchResultCount = customrecord_leve_setlmentSearchObj.runPaged().count;
        // log.debug("customrecord_leve_setlmentSearchObj result count", leaveSettlementsearchResultCount);

        if (leaveSettlementsearchResultCount > 0) {
            customrecord_leve_setlmentSearchObj.run().each(function (result) {

                var Employee = result.getValue({
                    name: "custrecord_njt_hr_ls_emp_id",
                    label: "Employee Id"
                });
                var LeaveApplication = result.getValue({
                    name: "custrecord_njt_hr_ls_leave_appl_number",
                    label: "Leave Appl.Number"
                });
                var LeaveSettlementAmount = result.getValue({
                    name: "custrecord_njt_hr_ls_amount_to_paid",
                    label: "Leave Settlement Amount"
                });
                var leaveSettlementDate = result.getValue({
                    name: "custrecord_njt_hr_ls_approved_from_date",
                    label: "Approved From Date"
                });
                ArrayData.push({
                    'Emp': Employee,
                    'Application': LeaveApplication,
                    'amount': LeaveSettlementAmount,
                    'dateConsidered': leaveSettlementDate
                })
                return true;
            });


            if (ArrayData.length > 0) {
                return ArrayData;
            } else {
                return null;
            }
        }
    } catch (e) {
        log.error("FindLeaveSettlement/Error", e);
    }
}

// Date: 20210904 Note - Take Leave Encashment Amount
function FindLeaveEncashment(payperiod) {
    try {
        var ArrayData = [];
        // Querying the required result
        var SQL = "SELECT custrecord_njt_hr_ls_encashment_amount AS EncashmentAmount, custrecord_njt_hr_ls_encashment_days AS EncashmentDays, custrecord_njt_hr_ls_emp_id AS empID, \
        custrecord_njt_hr_ls_leave_sttlmnt_date AS LeaveSettlementDate FROM customrecord_leve_setlment \
        WHERE custrecord_njt_hr_ls_trans_type = 2 AND custrecord_njt_hr_ls_paid_thru_payroll  = 'T' AND custrecord_njt_hr_ls_status = 2 AND custrecord_njt_hr_ls_pay_period = " + payperiod;
        log.debug("FindLeaveEncashment / query", SQL);
        // Run the query.
        var queryResults = QUERY.runSuiteQL({
            query: SQL
        });
        // Get the mapped results.
        var qRecords = queryResults.asMappedResults();
        log.debug('qRecords', JSON.stringify(qRecords));
        if (qRecords.length > 0) {
            for (r = 0; r < qRecords.length; r++) {
                // Get the record.
                var qRecord = qRecords[r];
                // log.debug('qRecord in ' + (r + 0), qRecord);
                var encashmentAmount = qRecord.encashmentamount;
                var encashmentDays = qRecord.encashmentdays;
                var emp_ID = qRecord.empid;
                var leaveSettlementDate = qRecord.leavesettlementdate;
                ArrayData.push({
                    'Emp': emp_ID,
                    'amount': encashmentAmount,
                    'encashDays': encashmentDays,
                    'dateConsidered': leaveSettlementDate
                })
            }
            if (ArrayData.length > 0) {
                return ArrayData;
            } else {
                return null;
            }
        }
    } catch (e) {
        log.error("FindLeaveEncashment/Error", e);
    }
}

function getOTConfigDetails(pRecId) {
    try {
        var output = {};
        var otConfigObj = RECORD.load({
            type: 'customrecord_njt_ot_config',
            id: pRecId,
            isDynamic: true,
        });
        output.HolidaySalaryFactor = otConfigObj.getValue("custrecord_njt_otc_holiday_sf") || 1;
        output.WeekEndSalaryFactor = otConfigObj.getValue("custrecord_njt_otc_weekend_sf") || 1;
        output.WeekDaySalaryFactor = otConfigObj.getValue("custrecord_njt_otc_weekday_sf") || 1;
        return output;
    } catch (e) {
        log.error('Error in getOTConfigDetails', e);
    }
}

function getBiometricSetupDetails(pRecId) {
    try {
        var output = {};
        var bioSetupObj = RECORD.load({
            type: 'customrecord_njt_prp_biometric_ded_set',
            id: pRecId,
            isDynamic: true,
        });
        // Late In Details
        output.lateInCase1_First = bioSetupObj.getValue("custrecord_njt_prp_bds_lic1_first") || 0;
        output.lateInCase1_Second = bioSetupObj.getValue("custrecord_njt_prp_bds_lic1_second") || 0;
        output.lateInCase1_Third = bioSetupObj.getValue("custrecord_njt_prp_bds_lic1_third") || 0;
        output.lateInCase1_AboveThird = bioSetupObj.getValue("custrecord_njt_prp_bds_lic1_above_third") || 0;

        output.lateInCase2_First = bioSetupObj.getValue("custrecord_njt_prp_bds_lic2_first") || 0;
        output.lateInCase2_Second = bioSetupObj.getValue("custrecord_njt_prp_bds_lic2_second") || 0;
        output.lateInCase2_Third = bioSetupObj.getValue("custrecord_njt_prp_bds_lic2_third") || 0;
        output.lateInCase2_AboveThird = bioSetupObj.getValue("custrecord_njt_prp_bds_lic2_above_third") || 0;

        output.lateInCase3_First = bioSetupObj.getValue("custrecord_njt_prp_bds_lic3_first") || 0;
        output.lateInCase3_Second = bioSetupObj.getValue("custrecord_njt_prp_bds_lic3_second") || 0;
        output.lateInCase3_Third = bioSetupObj.getValue("custrecord_njt_prp_bds_lic3_third") || 0;
        output.lateInCase3_AboveThird = bioSetupObj.getValue("custrecord_njt_prp_bds_lic3_above_third") || 0;

        // Early Out Details
        output.earlyOutCase1_First = bioSetupObj.getValue("custrecord_njt_prp_bds_eo1_first") || 0;
        output.earlyOutCase1_Second = bioSetupObj.getValue("custrecord_njt_prp_bds_eo1_second") || 0;
        output.earlyOutCase1_Third = bioSetupObj.getValue("custrecord_njt_prp_bds_eo1_third") || 0;
        output.earlyOutCase1_AboveThird = bioSetupObj.getValue("custrecord_njt_prp_bds_eo1_above_third") || 0;

        output.earlyOutCase2_First = bioSetupObj.getValue("custrecord_njt_prp_bds_eo2_first") || 0;
        output.earlyOutCase2_Second = bioSetupObj.getValue("custrecord_njt_prp_bds_eo2_second") || 0;
        output.earlyOutCase2_Third = bioSetupObj.getValue("custrecord_njt_prp_bds_eo2_third") || 0;
        output.earlyOutCase2_AboveThird = bioSetupObj.getValue("custrecord_njt_prp_bds_eo2_above_third") || 0;

        output.earlyOutCase3_First = bioSetupObj.getValue("custrecord_njt_prp_bds_eo3_first") || 0;
        output.earlyOutCase3_Second = bioSetupObj.getValue("custrecord_njt_prp_bds_eo3_second") || 0;
        output.earlyOutCase3_Third = bioSetupObj.getValue("custrecord_njt_prp_bds_eo3_third") || 0;
        output.earlyOutCase3_AboveThird = bioSetupObj.getValue("custrecord_njt_prp_bds_eo3_above_third") || 0;


        return output;
    } catch (e) {
        log.error('Error in getBiometricSetupDetails', e);
    }
}

// To get sql execution records.
function getResult(pSQL) {
    // log.debug("QUERY", pSQL);
    var queryResults = QUERY.runSuiteQL({
        query: pSQL
    });
    var records = queryResults.asMappedResults();
    return records;
}