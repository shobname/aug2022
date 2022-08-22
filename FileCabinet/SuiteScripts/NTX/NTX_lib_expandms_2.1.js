/**
 * @NApiVersion 2.1
 * v2    2022-02-25    Kenneth    BA-88200  Create $0 Approval Group Field in SOF and MS
 * v3    2022-04-26    Deepan    BA-89032 Strategic Deal value not populated in SKU based milestones
 */
define(['N/log', 'N/search', 'N/record', './NTX_Lib_FlexPicker'],

    function (log, search, record, flexLib) {

        const convert_Create_records_for_dates = (newRec, unitprice, totalCredits, per_day_credit, doId, serviceItem) => {
            let _flds_for_rec = {};
            _flds_for_rec.startdate = newRec.getValue('custrecord_ntx_expandms_startdate')
            _flds_for_rec.enddate = newRec.getValue('custrecord_ntx_expandms_enddate')

            _flds_for_rec.name = newRec.getValue('custrecord_ntx_do_ms_name')
            _flds_for_rec.proj_id = doId;
            _flds_for_rec.item = serviceItem;
            _flds_for_rec.serv_category = newRec.getValue('custrecord_ntx_do_service_category')
            _flds_for_rec.serv_category = newRec.getValue('custrecord_ntx_do_service_category')

            _flds_for_rec.proposed_usecase = newRec.getValue('custrecord_ntx_do_proposed_usecase')
            _flds_for_rec.secTypeId = newRec.getValue('custrecord_ntx_do_secondary_type');
            _flds_for_rec.flex_allocated = totalCredits;
            _flds_for_rec.flex_unit_price = unitprice;
            _flds_for_rec.per_day_credit = per_day_credit;
            _flds_for_rec.notMRR = true;

            _flds_for_rec.newRec = newRec;

            return Create_records_for_dates(_flds_for_rec);
        }


        const drawDown_convert_Create_records_for_dates = ( _flds_for_rec, newUnitPrice, flex_allocated, singleDayCred, doId, sku_id) => {

            _flds_for_rec.flex_allocated = flex_allocated;
            _flds_for_rec.flex_unit_price = newUnitPrice; //flex_unit_price;
            _flds_for_rec.per_day_credit = singleDayCred; //per_day_credit;
            _flds_for_rec.item = sku_id;
            _flds_for_rec.prop_secTypeId = "";

            _flds_for_rec.notMRR = false;


            return Create_records_for_dates(_flds_for_rec);
        }

        const Create_records_for_dates = (_flds_for_rec) => {

            var __startdate = _flds_for_rec.startdate;
            var __enddate = _flds_for_rec.enddate;

            var name = _flds_for_rec.name;


            var date = new Date(__startdate);

            var enddate = new Date(__enddate);
            var mon_diff = monthDiff(date, enddate);
            var totalDays = getNumberOfDays(date, enddate);

            var ii = mon_diff;

            var firstDay = date;
            var lastDay = '';

            var milestoneList = [];
            let obj_msId_childId={};
            do {
                firstDay = date;

                if (ii === 0) {
                    lastDay = enddate
                } else {
                    lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                }
                //callms & tasks
                log.debug(ii + ":::First day = " + firstDay + "<br>Last day = " + lastDay + "<br>");
                var final_name = name + "_" + firstDay.toLocaleDateString() + " TO " + lastDay.toLocaleDateString();
                //start of creating ms & proj tasks
                final_name = final_name.substring(0, 200);
                var _flds = {};
                _flds.final_name = final_name;
                _flds.firstDay = firstDay;
                _flds.lastDay = lastDay;
                _flds.proj_id = _flds_for_rec.proj_id;

                _flds.serv_cat = _flds_for_rec.serv_category;

                _flds.prop_usecaseId = _flds_for_rec.proposed_usecase;
                _flds.resourceId = _flds_for_rec.resource_id;

                if (_flds_for_rec.secTypeId)
                    _flds.prop_secTypeId = _flds_for_rec.secTypeId;
                _flds.flex_allocated = _flds_for_rec.flex_allocated;

                _flds.parent_startdate = __startdate;
                _flds.parent_enddate = __enddate;
                _flds.flex_unit_price = _flds_for_rec.flex_unit_price;
                _flds.per_day_credit = _flds_for_rec.per_day_credit;
                _flds.item = _flds_for_rec.item;
                _flds.notMRR = _flds_for_rec.notMRR;
                _flds.sofid = _flds_for_rec.sofid;

                if (_flds_for_rec.ncx == true) {
                    _flds.total_ncx_creds = _flds_for_rec.total_ncx_creds;
                    _flds.per_day_ncx_cred = _flds_for_rec.per_day_ncx_cred;
                    _flds.per_day_ncx_amt = _flds_for_rec.per_day_ncx_amt;
                    _flds.so_id = _flds_for_rec.so_id;
                    _flds.ncx = _flds_for_rec.ncx;
                    _flds.term_in_months = _flds_for_rec.term_in_months;
                    _flds.__ncx_cred_for_month=  calc_prorate_flexcred(firstDay, lastDay, _flds_for_rec.per_day_ncx_cred);
                    _flds.ncx_ms_amt_for_month= calc_prorate_flexcred(firstDay, lastDay, _flds_for_rec.per_day_ncx_amt);


                }

                var obj_lastMSDetails = func_createMS(_flds,ii);//getmsidobj.ms_id


                milestoneList.push(obj_lastMSDetails);
              //  const obj_msId_childId = {};

                if (_flds_for_rec.newRec) {
                    var fraction = getNumberOfDays(firstDay, lastDay) / totalDays;

                    flexLib.createEffortHours(obj_lastMSDetails.ms_id, _flds_for_rec.newRec, fraction, ii);
                }


                date = new Date(date.getFullYear(), date.getMonth() + 1);
                //alert(date);
                ii--;
            }
            while (ii >= 0)

            if(Object.keys(obj_msId_childId) >0) return obj_msId_childId;//return this for ncx
            else
            return milestoneList;

            //AUTOMATED_ASSIGNED_FLEX-totalcred
        }

        var AUTOMATED_ASSIGNED_FLEX = 0;

        const func_createMS = (_flds) => {
            var LAST_FLEX_MS_DETAILS = {};
            //name,suitelet_ms_id,  proj_id,sd,ed,serv_cat,flex_allocated
            //  var parentmsServiceItem = 23653;
            var name = _flds.final_name;

            var template_ms_id = 1861254;

            var proj_id = _flds.proj_id;
            var sd = _flds.firstDay;
            var ed = _flds.lastDay;
            var serv_cat = _flds.serv_cat;
            var prop_usecaseId = _flds.prop_usecaseId;
            var prop_secTypeId = _flds.prop_secTypeId;
            var flex_allocated = _flds.flex_allocated;
            var parent_sd = _flds.parent_startdate;
            var parent_ed = _flds.parent_enddate;
            var resourceId = _flds.resourceId;
            var soFinanceRecId = _flds.sofid;

            var flex_unit_price = _flds.flex_unit_price;
            var ms_amt_for_month = '';

            var recObj = record.copy({
                type: record.Type.PROJECT_TASK,
                id: template_ms_id

            });

            var MS_STATUS_SCHEDULED = 5;
            const MS_STATUS_RECOGNIZED = 8;
            var FORECAST_COMMIT = '4';

            // log.audit(new Date(new Date().toDateString()) > new Date(ed), new Date(new Date().toDateString()) + "__" + new Date(ed) + "_" + name);
            var __msstatus = MS_STATUS_SCHEDULED;

            let MS_STATUS_QUALIFIER_AUTO_RECOGNIZED = 55;
            const MS_STATUS_QUALIFIER_NO_PREWORK_REQUIRED = 27;
            if (_flds.notMRR) {
                MS_STATUS_QUALIFIER_AUTO_RECOGNIZED = MS_STATUS_QUALIFIER_NO_PREWORK_REQUIRED;
            }
log.debug('ncx,', _flds.ncx);
            if (_flds.ncx == true) {
            //    recObj.setValue('custevent_ntx_unity_term_months', term_in_months);
                var __ncx_cred_for_month =  _flds.__ncx_cred_for_month;//calc_prorate_flexcred(sd, ed, _flds.per_day_ncx_cred);
                ms_amt_for_month =  _flds.ncx_ms_amt_for_month;//calc_prorate_flexcred(sd, ed, _flds.per_day_ncx_amt);
                recObj.setValue({
                    fieldId: 'custevent_ntx_unity_credits',
                    value: __ncx_cred_for_month
                });
                recObj.setValue({
                    fieldId: 'custevent_ntx_do_related_so',
                    value:  _flds.so_id
                });
                recObj.setValue({
                    fieldId: 'custevent_ntx_unity_term_months',
                    value:  _flds.term_in_months
                });

                LAST_FLEX_MS_DETAILS.__ncx_cred_for_month = __ncx_cred_for_month;
                LAST_FLEX_MS_DETAILS.ms_amt_for_month = ms_amt_for_month;
//
            } else {

                var __flex_cred_for_month = calc_prorate_flexcred(sd, ed, _flds.per_day_credit);
                AUTOMATED_ASSIGNED_FLEX = AUTOMATED_ASSIGNED_FLEX + __flex_cred_for_month;

                ms_amt_for_month = __flex_cred_for_month * flex_unit_price;
                //we cant fill this since this will affect balance, credits allocated field.

                recObj.setValue({
                    fieldId: 'custevent_ntx_flex_credit_allocated',
                    value: __flex_cred_for_month
                });

                recObj.setValue({
                    fieldId: 'custevent_ntx_sl_flex_allocated',
                    value: flex_allocated
                });
            }
            if (new Date(new Date().toDateString()) > new Date(ed)) {

                __msstatus = MS_STATUS_RECOGNIZED;
                MS_STATUS_QUALIFIER_AUTO_RECOGNIZED = '';
                //   CHILD_ALLOCATED_FLEX = pnvl(CHILD_ALLOCATED_FLEX, true) + pnvl(__flex_cred_for_month, true);
            }
            log.audit('mstatus', __msstatus);

            recObj.setValue({
                fieldId: 'custevent_ms_status',
                value: __msstatus,
            });
            recObj.setValue({
                fieldId: 'custevent_ms_status_qualifiers',
                value: MS_STATUS_QUALIFIER_AUTO_RECOGNIZED,
            });
            // if(name.toString().toLowerCase().indexOf('flex') ===-1)
            if (serv_cat) {
                recObj.setValue({
                    fieldId: 'custevent_service_category',
                    value: serv_cat,
                });
            }
            if (prop_usecaseId) {

                recObj.setValue({
                    fieldId: 'custevent_proposed_use_case',
                    value: prop_usecaseId,
                });

            }

            if (prop_secTypeId) {

                recObj.setValue({
                    fieldId: 'custevent_secondary_type',
                    value: prop_secTypeId,
                });

            }

            recObj.setValue({
                fieldId: 'custevent_milestone_amount',
                value: ms_amt_for_month
            });

            recObj.setValue({
                fieldId: 'estimatedwork',
                value: '1'
            });

            recObj.setValue({
                fieldId: 'custevent_ntx_sl_start_date',
                value: new Date(parent_sd)
            });
            recObj.setValue({
                fieldId: 'custevent_ntx_sl_end_date',
                value: new Date(parent_ed)
            });
            ///
            recObj.setValue({
                fieldId: 'title',
                value: name
            });
            recObj.setValue({
                fieldId: 'company',
                value: proj_id
            });

            recObj.setValue({
                fieldId: 'startdate',
                value: new Date(sd)
            });

            recObj.setValue({
                fieldId: 'custevent_ntx_revenue_date',
                value: new Date(ed)
            });
            var __obj_QYR = getCurrentQtrYear(ed);

            recObj.setText({
                fieldId: 'custevent_milestone_quarter',
                text: (__obj_QYR.quarter).toString(),
            });
            recObj.setText({
                fieldId: 'custevent_milestone_year',
                text: (__obj_QYR.year).toString(),
            });
            recObj.setValue({
                fieldId: 'custevent_ntx_lst_proj_tsk_forecst_stat',
                value: FORECAST_COMMIT
            });
            recObj.setValue({
                fieldId: 'custevent_ntx_lst_proj_tsk_forecst_stat',
                value: FORECAST_COMMIT
            });

            recObj.setValue({
                fieldId: 'custevent_ntx_ms_serv_item',
                value: _flds.item
            });

            if (soFinanceRecId) { //BA-89032

                var sofRecFieldsLookup = search.lookupFields({
                    type: 'customrecord_ntx_so_finance',
                    id: soFinanceRecId,
                    columns: ['custrecord_ntx_sof_strategic_deal']
                });

                //log.debug('sofRecFieldsLookup', sofRecFieldsLookup);

                if (sofRecFieldsLookup) {
                    var strategicDeal = sofRecFieldsLookup.custrecord_ntx_sof_strategic_deal;

                    log.debug('strategicDeal:', strategicDeal);

                    if (strategicDeal == 'T') {
                        strategicDeal = true;
                    }

                    if (strategicDeal == 'F') {
                        strategicDeal = false;
                    }

                    recObj.setValue({
                        fieldId: 'custevent_ntx_key_engagement_ms',
                        value: strategicDeal
                    });


                }

            }


            var parent_msid = recObj.save();

            if (parent_msid && resourceId) {

                var resourceAllocationId = createResourceAllocation(proj_id, parent_msid, resourceId, sd, ed);

                if (resourceAllocationId)
                    log.debug('Resource Allocation saved successfully: ', resourceAllocationId);

            }

            //** for discrepancy

          //clear every time to store new details
            LAST_FLEX_MS_DETAILS.flexallocated = __flex_cred_for_month;
            LAST_FLEX_MS_DETAILS.flexunitprice = flex_unit_price;

            LAST_FLEX_MS_DETAILS.name = name;

            LAST_FLEX_MS_DETAILS.ms_id = parent_msid;

            LAST_FLEX_MS_DETAILS.lastmsid = parent_msid;
            LAST_FLEX_MS_DETAILS.totalcreds = AUTOMATED_ASSIGNED_FLEX;
            LAST_FLEX_MS_DETAILS.lastmscred = __flex_cred_for_month;

            //** for discrepancy

            return LAST_FLEX_MS_DETAILS;

        }

        function setCustLogistics(msId, sofId) {
            let sofCustVals = search.lookupFields({
                type: 'customrecord_ntx_so_finance',
                id: sofId,
                columns: [
                    'custrecord_ntx_so_finance_customer',
                    'custrecord_ntx_so_finance_end_user',
                    'custrecord_ntx_so_finance_cus_email',
                    'custrecord_ntx_so_finance_cus_first_name',
                    'custrecord_ntx_so_finance_cus_last_name',
                    //'custrecord_ntx_so_finance_cus_address',   //Deepan: Commented this line temporarily for testing MRR
                    'custrecord_ntx_so_finance_cus_phone_num',
                    'custrecord_ntx_so_finance_hypervisor',
                    'custrecord_ntx_so_finance_install_street',
                    'custrecord_ntx_so_finance_install_city',
                    'custrecord_ntx_so_finance_install_state',
                    'custrecord_ntx_so_finance_ins_postalcode',
                    'custrecord_ntx_so_finance_install_cntry',
                    'custrecord_ntx_so_finance_reseller_name',
                    'custrecord_ntx_so_finance_reseller_addr',
                    'custrecord_ntx_so_finance_disti_name',
                    'custrecord_ntx_so_finance_disti_address',
                    'custrecord_ntx_so_finance_theater',
                    'custrecord_ntx_so_finance_region',
                    'custrecord_ntx_so_finance_subregion',
                    'custrecord_ntx_zero_approval_group'
                ]
            });
            log.debug('sofCustVals', JSON.stringify(sofCustVals));
            let msValuesToUpdate = {};
            msValuesToUpdate.custevent_ntx_so_finance_customer = sofCustVals.custrecord_ntx_so_finance_customer[0].value;
            msValuesToUpdate.custevent_ntx_ms_end_user = sofCustVals.custrecord_ntx_so_finance_end_user[0].value;
            msValuesToUpdate.custevent_ntx_ms_cus_email = sofCustVals.custrecord_ntx_so_finance_cus_email;
            msValuesToUpdate.custevent_ntx_ms_cus_first_name = sofCustVals.custrecord_ntx_so_finance_cus_first_name;
            msValuesToUpdate.custevent_ntx_ms_cus_last_name = sofCustVals.custrecord_ntx_so_finance_cus_last_name;
            //msValuesToUpdate.custevent_ntx_ms_cus_address = sofCustVals.custrecord_ntx_so_finance_cus_address;   //Deepan: Commented this line temporarily for testing MRR
            msValuesToUpdate.custevent_ntx_ms_cus_phone_num = sofCustVals.custrecord_ntx_so_finance_cus_phone_num;
            msValuesToUpdate.custevent_ntx_ms_hypervisor = sofCustVals.custrecord_ntx_so_finance_hypervisor[0] ? sofCustVals.custrecord_ntx_so_finance_hypervisor[0].value : "";
            msValuesToUpdate.custevent_ntx_ms_install_street = sofCustVals.custrecord_ntx_so_finance_install_street;
            msValuesToUpdate.custevent_ntx_ms_install_city = sofCustVals.custrecord_ntx_so_finance_install_city;
            msValuesToUpdate.custevent_ntx_ms_install_state = sofCustVals.custrecord_ntx_so_finance_install_state;
            msValuesToUpdate.custevent_ntx_ms__ins_postalcode = sofCustVals.custrecord_ntx_so_finance_ins_postalcode;
            msValuesToUpdate.custevent_ntx_ms_install_cntry = sofCustVals.custrecord_ntx_so_finance_install_cntry;
            msValuesToUpdate.custevent_ntx_ms_reseller_name = sofCustVals.custrecord_ntx_so_finance_reseller_name;
            msValuesToUpdate.custevent_ntx_ms_reseller_addr = sofCustVals.custrecord_ntx_so_finance_reseller_addr;
            msValuesToUpdate.custevent_ntx_ms_disti_name = sofCustVals.custrecord_ntx_so_finance_disti_name;
            msValuesToUpdate.custevent_ntx_ms_disti_address = sofCustVals.custrecord_ntx_so_finance_disti_address;

            msValuesToUpdate.custevent_ntx_ms_theater = sofCustVals.custrecord_ntx_so_finance_theater[0] ? sofCustVals.custrecord_ntx_so_finance_theater[0].value : "";
            msValuesToUpdate.custevent_ntx_ms_region = sofCustVals.custrecord_ntx_so_finance_region[0] ? sofCustVals.custrecord_ntx_so_finance_region[0].value : "";
            msValuesToUpdate.custevent_ntx_ms_subregion = sofCustVals.custrecord_ntx_so_finance_subregion;
            msValuesToUpdate.custevent_ntx_zero_approval_group = sofCustVals.custrecord_ntx_zero_approval_group[0] ? sofCustVals.custrecord_ntx_zero_approval_group[0].value : "";

            record.submitFields({
                type: 'projecttask',
                id: msId,
                values: msValuesToUpdate
            });

        }

        function monthDiff(startdate, enddate) {
            dateFrom = new Date(startdate);
            dateTo = new Date(enddate);
            return dateTo.getMonth() - dateFrom.getMonth() +
                (12 * (dateTo.getFullYear() - dateFrom.getFullYear()))
        }

        const calc_singledayflexcred = (sd, ed, totalFlexcred) => {
            //overall sd,ed
            var Difference_In_Days = getNumberOfDays(sd, ed)

            return totalFlexcred / Difference_In_Days;


        }

        const calc_prorate_flexcred = (sd, ed, per_day_cred) => {

            var Difference_In_Days = getNumberOfDays(sd, ed)

            var flexcred = Math.round(Difference_In_Days * per_day_cred);

            return flexcred;
        }

        const getNumberOfDays = (sd, ed) => {
            sd = new Date(sd);
            ed = new Date(ed);
            var Difference_In_Time = ed.getTime() - sd.getTime();
            var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
            Difference_In_Days = Difference_In_Days + 1;
            return Difference_In_Days;
        }
        const getCurrentQtrYear = (dt) => {

            var date = new Date(dt);
            var yy = date.getFullYear();
            var month = date.getMonth();
            month = parseInt(month) + 1;


            var quarter = '';
            if (month >= 8 && month <= 10) {
                quarter = 'Q1';

            }
            if ((month >= 11 && month <= 12) || (month == 1)) {
                quarter = 'Q2';
            }
            if (month >= 2 && month <= 4) {
                quarter = 'Q3';
            }
            if (month >= 5 && month <= 7) {
                quarter = 'Q4';
            }
            if (month >= 8 && month <= 12) {
                yy = parseInt(yy) + 1;
            }


            var dtQtrYear = {};
            dtQtrYear.quarter = quarter;
            dtQtrYear.year = yy;


            return dtQtrYear;
        }

        function createResourceAllocation(projectId, msId, resourceId, __startdate, __enddate) {

            var resourceAllocationRecObj = record.create({
                type: 'resourceallocation',
                isDynamic: true
            });

            resourceAllocationRecObj.setValue('project', projectId);
            resourceAllocationRecObj.setValue('projecttask', msId);
            resourceAllocationRecObj.setValue('allocationresource', resourceId);
            resourceAllocationRecObj.setValue('startdate', new Date(__startdate));
            resourceAllocationRecObj.setValue('enddate', new Date(__enddate));
            resourceAllocationRecObj.setValue('allocationamount', 100);
            resourceAllocationRecObj.setValue('allocationtype', 1); //1 : Hard

            var resRecId = resourceAllocationRecObj.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            return resRecId;

        }

        return {

            getNumberOfDays: getNumberOfDays,
            calc_prorate_flexcred: calc_prorate_flexcred,
            func_createMS: func_createMS,
            Create_records_for_dates: Create_records_for_dates,
            convert_Create_records_for_dates: convert_Create_records_for_dates,
            drawDown_convert_Create_records_for_dates: drawDown_convert_Create_records_for_dates,
            calc_singledayflexcred: calc_singledayflexcred,
            getCurrentQtrYear: getCurrentQtrYear,
            setCustLogistics: setCustLogistics,
            createResourceAllocation: createResourceAllocation,
            monthDiff: monthDiff
        };

    });