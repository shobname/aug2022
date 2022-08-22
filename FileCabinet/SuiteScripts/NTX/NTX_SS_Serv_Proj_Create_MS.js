/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
/*
 * v1.0 shobiya dec 12 	BA-66707 TAM/Residency Milestone Creation
 * v1.2 shobiya apr 12 	2020 BA-70381
 *  2.1	shobiya	 june 11 2020 ba-72220
 *  v2.2 deepan  dec 24 2020 BA-74231 Add Proposed Use Case field
 *  2.3		shobiya dec 30 2020		/BA-71542
 *  2.4   12/17/20            Joseph Kim      BA-76986: Cannot update Revenue Date, replace finishbydate with custevent_ntx_revenue_date
 *  2.5		   deepan      		 feb 22 2020      BA-72359 RES/TAM Draw Down Email Automation
 *  2.6		   deepan      		 Sep 22 2020      BA-81442 Have Resident resource assigned on automated MS Expansion
 *  2.7		   shobiya/deepan    Nov 16 2021      BA-86564 Reactivate the SKU Templates in the Send RES/TAM Draw Down, Reactivate Expand MS
 *  2.8		   kenneth 			 Feb 07 2022	  BA-84800 Create Flex Dashboard for Each SKU in SOF
 *  2.9		   deepan 			 Apr 26 2022	  BA-89032 Strategic Deal value not populated in SKU based milestones
 *  2.10        deepan 			 Jun 26 2022	  BA-85692 Link Expanded Children on WaR DO to SOF (****Not went to PROD****)
 *  3.0		shobiya.  			july 28 22 BA-86838 Fix MS Expansion to distribute the LOE of Parent across Children
 *
 * * */
var template_search = '';
var template_ms_id = '';

var MS_STATUS_SCHEDULED = 5;
var MS_STATUS_RECOGNIZED = 8;
var MS_STATUS_QUALIFIER_AUTO_RECOGNIZED = 55;
var PER_DAY_AMT = '';
var PER_DAY_CRED = '';
var MAILBODY = '';
var str_template = '';
var flexallocated = '';
var Customer_Not_Ready = '2';
var Undefined_FlexCredit_Use = '12';
var AUTOMATED_ASSIGNED_FLEX = 0; // manage discrepancy due to rounding of flex
var PARENT_FLEX_MS_ID = '';
var LAST_FLEX_MS_DETAILS = {};
var _REV_DATE = '';
var FORECAST_COMMIT = '4';
var CHILD_ALLOCATED_FLEX = 0;
/** SHOB:User enters 100, but automation allocates 99, hence can we consider 99 as final value & use this number to deduct from remaining credits?
 PETE: you should add it to the last one.
 **/
define(['N/runtime', 'N/render', 'N/record',  'N/ui/serverWidget', 'N/email', 'N/search', 'N/task', 'N/runtime', 'N/config', '/SuiteScripts/NTX/NTX_lib_CreateMS', '/SuiteScripts/NTX/NTX_lib_expandms_2.1', '/SuiteScripts/NTX/NTX_Lib_FlexPicker.js'],

    function(runtime, render, record,  ui, email, search, task, runtime, config, lib, lib_expandMs, lib_flex_picker) {
        /**
         * Definition of the Scheduled script trigger point.
         *
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */
        //start of disc code
        function checkflex_discrepancy(flexallocated_from_screen) {
            //	return;
            try {
                log.debug('flexallocated_from_screen:', flexallocated_from_screen + "_" + AUTOMATED_ASSIGNED_FLEX);
                if (AUTOMATED_ASSIGNED_FLEX > 0 && flexallocated_from_screen != AUTOMATED_ASSIGNED_FLEX && Object.keys(LAST_FLEX_MS_DETAILS).length != 0) {
                    var _round_details = '';
                    var ms_id = LAST_FLEX_MS_DETAILS.ms_id;
                    log.debug('triggering discrepancy code', flexallocated_from_screen + "_" + ms_id);
                    var flex_in_ms = LAST_FLEX_MS_DETAILS.flexallocated
                    var _name = LAST_FLEX_MS_DETAILS.name
                    var _unitprice = LAST_FLEX_MS_DETAILS.flexunitprice;
                    log.debug('discp', _unitprice + "::" + flex_in_ms);
                    var _newmsprice = parseInt(flex_in_ms) * parseFloat(_unitprice);
                    log.debug('flexallocated_from_screen:msid', ms_id + "_" + flex_in_ms);
                    var _diffcred = (parseInt(flexallocated_from_screen) - parseInt(AUTOMATED_ASSIGNED_FLEX));
                    log.debug('diffcred', _diffcred);
                    var new_flex_cred = parseInt(flex_in_ms) + _diffcred;
                    log.debug("new_flex_cred:_newmsprice", new_flex_cred + "__" + _newmsprice);
                    _round_details = "Flex allocated by user in screen:" + flexallocated_from_screen + ".  Flex allocated using automation:" + AUTOMATED_ASSIGNED_FLEX +
                        ".  Difference in credits: " + _diffcred + ".  Old flex in last ms : " + flex_in_ms + ".  MS Internal Id:" + ms_id + ".  Final flex stored in ms is:" + new_flex_cred;
                    record.submitFields({
                        type: record.Type.PROJECT_TASK,
                        id: ms_id,
                        values: {
                            custevent_ntx_flex_credit_allocated: new_flex_cred,

                            custevent_milestone_amount: _newmsprice,
                            custevent_ntx_proj_expandms_round_det: _round_details

                        }
                    });

                    //	Deepan : Sep 22, 2021
                    /*    log.debug('PARENT_FLEX_MS_ID', PARENT_FLEX_MS_ID);
                        var _flds = search.lookupFields({
                            type: search.Type.PROJECT_TASK,
                            id: PARENT_FLEX_MS_ID,
                            columns: ['title', 'custevent_ntx_flex_credit_allocated']
                        });

                        var p_name = _flds.title;
                        var p_existing_creds = _flds.custevent_ntx_flex_credit_allocated;
                        var p_new_creds = parseInt(p_existing_creds) - parseInt(_diffcred);
                        log.debug("parent flex:_newmsprice", p_existing_creds + "__" + _diffcred);
                        var _newname = replacename(p_name, p_new_creds); //replace <> in name
                        var p_newmsprice = parseInt(p_new_creds) * parseFloat(_unitprice);
                        log.debug("parent flex:_newmsprice", p_new_creds + "__" + p_newmsprice);*/



                    ///UPDATE PARENT MS

                }
            } catch (e) {
                log.error('cannot update discrepancy', flexallocated_from_screen + " err:" + e);
            }
        }
        //end of disc code
        function execute(scriptContext) {
            try {

                var scriptObj = runtime.getCurrentScript();

                var _mailsender = scriptObj.getParameter({
                    name: 'custscript_ntx_mail_sender'
                });
                var __manager = [];
                var str_selected = scriptObj.getParameter({
                    name: 'custscript_ntx_txt_raw_data'
                });
                //V2.5 : Start

                var mcf_senderId = scriptObj.getParameter({
                    name: 'custscript_ntx_sender_id'
                });

                log.debug('mcf_senderId: ', mcf_senderId);

                //V2.5 : End
                var proj_id = scriptObj.getParameter({
                    name: 'custscript_ntx_serv_proj_id'
                });
                template_search = scriptObj.getParameter({
                    name: 'custscript_ntx_ss_sp_template_search'
                });
                str_template = scriptObj.getParameter({
                    name: 'custscript_ntx_temp_sp_expand_ms'
                });
                var EmailMergeResult = render.mergeEmail({
                    templateId: str_template

                });

                var subject = EmailMergeResult.subject;
                var body = EmailMergeResult.body;
                //	log.debug('prj_id',proj_id);
                //var MAILBODY = scriptObj.getParameter({name: 'custscript_ntx_txt_mail_body'});
                //***script params
                var selected = JSON.parse(str_selected);

                //get flds from proj
                var proj_flds = search.lookupFields({
                    type: search.Type.JOB,
                    id: proj_id,
                    columns: ['companyname', 'custentity_ntx_assigned_manager', 'custentity_ntx_srp_flex_price_per_credit',
                        'custentity_credits_balance', 'custentity_ntx_srp_flex_cre_allo_consump', 'startdate'
                    ]
                });
                var proj_start_date = proj_flds.startdate;

                var flex_unit_price = proj_flds.custentity_ntx_srp_flex_price_per_credit;
                var curr_flex_cred_balance = proj_flds.custentity_credits_balance;
                var curr_flex_cred_allocated = proj_flds.custentity_ntx_srp_flex_cre_allo_consump;

                var proj_name = proj_flds.companyname;
                subject = subject.replace('#PROJ_NAME#', proj_name);
                var _manager = proj_flds.custentity_ntx_assigned_manager;
                //****get flds from proj
                var main_flds = {};
                main_flds.flex_unit_price = flex_unit_price;
                main_flds.flex_cred_balance = curr_flex_cred_balance;
                main_flds.proj_id = proj_id;

                MAILBODY = '';
                MAILBODY += '<table border=1 cellspacing=0 cellpadding=0>';
                MAILBODY += '<tr>';
                MAILBODY += '<td><b>MS NAME</b></td><td><b>NEW NAME</b></td><td><b>START DATE</b></td><td><b>END DATE</b></td><td><b>FLEX ALLOCATED</b></td>';
                MAILBODY += '</tr>';

                Process_selected_records(selected, main_flds); // ms submit
                //
                //  log.debug('least ms start date',least_ms_start_date);
                var __obj = {};

                if (flexallocated) {
                    checkflex_discrepancy(flexallocated);

                    //Deepan : Sep :22, 2021
                    /*  var new_cred_bal = pnvl(curr_flex_cred_balance, true) - pnvl(flexallocated, true);
                      var new_cred_allocated = pnvl(curr_flex_cred_allocated, true) + pnvl(flexallocated, true) - pnvl(CHILD_ALLOCATED_FLEX, true);
                      __obj.custentity_credits_balance = new_cred_bal;
                      __obj.custentity_ntx_srp_flex_cre_allo_consump = new_cred_allocated;*/

                }

                //Deepan : Sep :22, 2021
                /*   try {
                       record.submitFields({
                           type: record.Type.JOB,
                           id: proj_id,
                           values: __obj
                       });
                   }
                   //throwing error for user to know to save them manually incase of error
                   catch (e) {
                       throw " Error while saving values in project for Credit balance & Credits allocate. Please enter them manually: error " + e;
                   }*/
                //email to user


                body = body.replace('#LINES#', MAILBODY);
                body = body.replace('#PROJ_NAME#', proj_name);




                if (_manager && _manager != '') {
                    __manager = _manager[0].value.toString().split();
                }




                //***email to user
            } catch (e) {
                body = body + "/n" + e;
                log.error('error while creating ms:proj' + proj_id, "   error:" + e)
            } finally {
                log.debug('sending email to user & manager');
                //V2.5 : Start

                var receipient_id = runtime.getCurrentUser().id;

                if (mcf_senderId != null && mcf_senderId != "" && mcf_senderId != undefined)
                    receipient_id = mcf_senderId;

                //V2.5 : End

                email.send({
                    author: _mailsender,
                    recipients: receipient_id,
                    cc: __manager,
                    subject: subject,
                    body: body
                });
            }
        }

        function replacename(name, rem_cred_bal) {
            name = name.toString().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<.*>/, '');
            //name = name.replace(/&lt;.*&gt;/, '');
            var parentname = name + "<" + rem_cred_bal + ">";
            return parentname;
        }

        function Process_selected_records(selected, main_flds) {


            var flex_unit_price = main_flds.flex_unit_price;
            var flex_cred_balance = main_flds.flex_cred_balance;
            var proj_id = main_flds.proj_id;

            StoreGlobalValuesforProjectTasks(template_search);

            selected.forEach(function(_line) {
                var isNonBillableMS = false;
                var __msAmtForPerDayCalc = 0;
                var shadow_revenue = 0;
                var suitelet_ms_id = _line.internalid; //main ms id // fetch sof header & ms amt
                var name = _line.name;
                var isflex = _line.isflex;
                log.debug('is flex', isflex);
                //    _obj.isflex = fields[10];
                var newname = _line.newname;
                var serv_category = _line.servicecategory;
                var proposed_usecase = _line.proposedusecase; //v2.2 - BA-74231

                if (!proposed_usecase) //v2.2 - BA-74231
                    proposed_usecase = "";

                var startdate = _line.startdate;

                var enddate = _line.enddate;
                var ms_amt = _line.ms_amt;
                var flex_allocated = _line.flex_allocated;
                var _resource_id = _line.resource_id;
                var sofid = _line.sofid;
                if (!ms_amt) ms_amt = 0;
                var _processdone = true;
                if (!serv_category) serv_category = null;
                var _vals = {};
                MAILBODY += '<td>' + name + '</td><td>' + newname + '</td><td>' + startdate + '</td><td>' + enddate + '</td>';
                var _flds_for_rec = {};
                _flds_for_rec.startdate = startdate;
                _flds_for_rec.enddate = enddate;
                _flds_for_rec.suitelet_ms_id = suitelet_ms_id;
                _flds_for_rec.name = newname;
                _flds_for_rec.proj_id = proj_id;
                _flds_for_rec.serv_category = serv_category;
                _flds_for_rec.proposed_usecase = proposed_usecase; //v2.2 - BA-74231
                _flds_for_rec.flex_allocated = flex_allocated;
                _flds_for_rec.flex_unit_price = flex_unit_price;
                _flds_for_rec.resource_id = _resource_id;
                _flds_for_rec.sofid = sofid;
                let projTask_rec =record.load({
                    type:'projecttask',
                    id:suitelet_ms_id
                });
                    _flds_for_rec.newRec = projTask_rec;

                isNonBillableMS = projTask_rec.getValue('nonbillabletask');
                shadow_revenue = projTask_rec.getValue('custevent_shadow_rev_ms');

                _flds_for_rec.isNonBillableParentMS = isNonBillableMS;
                _flds_for_rec.milestone_amt = ms_amt;
                _flds_for_rec.shadow_revenue_amt = shadow_revenue;

                if (isflex.toString().toLowerCase() == 'flex') {
                    if (suitelet_ms_id)
                        PARENT_FLEX_MS_ID = suitelet_ms_id;
                    flexallocated = flex_allocated;
                    calc_singledayflexcred(startdate, enddate, flex_allocated);
                    //flex items
                    MAILBODY += '<td>' + flex_allocated + '</td>';

                    _vals.custevent_milestone_amount = 0;
                    _vals.custevent_milestone_year = '';
                    _vals.custevent_milestone_quarter = '';
                    _vals.finishbydate = '';
                    _vals.custevent_ms_status = 9;
                    _vals.custevent_ms_status_qualifiers = '';
                    _vals.custevent_service_category = serv_category;
                    _vals.custevent_proposed_use_case = proposed_usecase;


                    _processdone = true; //Deepan : Sep 22, 2021


                } else {
                    MAILBODY += '<td>' + '' + '</td>';

                    _vals.custevent_milestone_amount = 0;
                    _vals.custevent_milestone_year = '';
                    _vals.custevent_milestone_quarter = '';
                    _vals.finishbydate = '';
                    _vals.custevent_ms_status = 9;
                    _vals.custevent_ms_status_qualifiers = '';
                    _vals.custevent_service_category = serv_category;
                    _vals.custevent_proposed_use_case = proposed_usecase; //v2.2 - BA-74231
                    log.audit('serv_category', serv_category + "::" + proposed_usecase);

                }

                MAILBODY += '<tr>';

                if (isflex.toString().toLowerCase() != 'flex') { //Non Flex SKU


                    __msAmtForPerDayCalc = ms_amt;


                    if (isNonBillableMS == 'T' || isNonBillableMS == true) {
                        __msAmtForPerDayCalc = shadow_revenue;
                        // ms_amt = shadow_revenue;
                    }

                    var parentMSSOFDetailValues = getParentMSSOFDetailValues(suitelet_ms_id);

                    _flds_for_rec.sf_orderLine_id =   parentMSSOFDetailValues[0];
                    _flds_for_rec.so_line_id = parentMSSOFDetailValues[1];
                    _flds_for_rec.at_risk_ms_sof_item_qty = parentMSSOFDetailValues[2];;

                    calc_singledayamt(startdate, enddate, __msAmtForPerDayCalc);
                    Create_records_for_dates_non_flex(_flds_for_rec, __msAmtForPerDayCalc);

                } else { //Flex

                    let singleDayCred = lib_expandMs.calc_singledayflexcred(startdate, enddate, flex_allocated);
                    if (parseFloat(singleDayCred) < 1) {
                        //  throw "DO PROJECT: not enough credits to distribute. Increase revenue amount";
                    }
                    //lib.expandMsFeature(sd,ed,calculatedFlexCredits_ForMs);
                    let newUnitPrice = parseFloat(ms_amt) / parseFloat(flex_allocated);

                    //ms_amt = newUnitPrice * flex_allocated;

                    //let doId = lib.create_DO_ForFlex(calculatedFlexCredits_ForMs, calculatedMsAmount_ForMs, newRec, recentSO_ForMs); //creates one do

                    let doId = proj_id;

                    // the skus should all be the same
                    let sku_id = 197438; // obj_sofQuanDetails[Object.keys(obj_sofQuanDetails)[0]].sku_id;

                    // let totalDaysOverall = lib_expandMs.getNumberOfDays(sd,ed);
                    //	 let actualFlexDifference =Math.round((parseFloat(totalDaysOverall)*parseFloat(singledaycred)))- parseFloat(calculatedFlexCredits_ForMs);
                    let ms_details = lib_expandMs.drawDown_convert_Create_records_for_dates(_flds_for_rec, newUnitPrice, flex_allocated, singleDayCred, doId, sku_id);
                    //let obj_last_ms_details= lib_expandMs.Create_records_for_dates(obj_flds);
                    let lastMilestone = ms_details[ms_details.length - 1]
                    let lastmsid = lastMilestone.lastmsid;
                    let totalcreds = lastMilestone.totalcreds;
                    let unitprice = lastMilestone.flexunitprice;
                    let delta = (flex_allocated - totalcreds);

                    log.debug('delta: ', delta);

                    //submit last ms with new cred & amt
                    if (delta != 0) {

                        let lastmscred = lastMilestone.lastmscred;
                        lastmscred = lastmscred + delta;

                        record.submitFields({
                            type: 'projecttask',
                            id: lastmsid,
                            values: {
                                custevent_ntx_flex_credit_allocated: lastmscred,
                                custevent_milestone_amount: parseFloat(unitprice) * parseFloat(lastmscred)
                            }
                        });

                        lastMilestone.flexallocated = lastmscred;

                        ms_details[ms_details.length - 1] = lastMilestone;

                    }

                    let searchResult = lib_flex_picker.drawDownrunSearch(suitelet_ms_id);

                    let obj_toUse_Flex_Amt = lib_flex_picker.calculate_toUse_Flex_Amt(searchResult, ms_amt, 'DRAW_DOWN');

                    log.debug('obj_toUse_Flex_Amt', JSON.stringify(obj_toUse_Flex_Amt));
                    /*   let calculatedFlexCredits_ForMs = obj_toUse_Flex_Amt.flex;
                       let calculatedMsAmount_ForMs = obj_toUse_Flex_Amt.msamount;*/
                    let recentSO_ForMs = ""; //obj_toUse_Flex_Amt.recentSO;
                    let obj_sofQuanDetails = obj_toUse_Flex_Amt.obj_sofDetailsId;

                    createSOFRecords(obj_sofQuanDetails, ms_details, doId);

                    //Remove SOF Records
                    removeParentFlexSOFDetailrecords(suitelet_ms_id);

                    //Remove Resource Allocation Records
                    lib_flex_picker.getResourceAllocation(suitelet_ms_id);

                    try {
                        record.delete({
                            type: 'projecttask',
                            id: suitelet_ms_id
                        });

                        suitelet_ms_id = "";

                    } catch (ex) {
                        log.error('Error while deleting Parent Flex Ms: ', ex.message);
                    }


                }

                _vals.custevent_ntx_processed_with_sl = _processdone;
                _vals.custevent_ntx_sl_start_date = new Date(startdate);

                _vals.custevent_ntx_sl_end_date = new Date(enddate);

                if (suitelet_ms_id) {
                    record.submitFields({
                        type: record.Type.PROJECT_TASK,
                        id: suitelet_ms_id,
                        values: _vals
                    });
                }

            });

        }

        const createSOFRecords = (obj_sofQuanDetails, ms_details, doId) => {
            //put into a list to make it easier
            let sofDetailList = [];
            for (let sofDetailId in obj_sofQuanDetails) {
                let sofDetails = obj_sofQuanDetails[sofDetailId];
                sofDetails.id = sofDetailId;
                sofDetailList.push(sofDetails);
            }
            let sofDetailIdx = 0;
            log.debug('sofDetailIdx', JSON.stringify(sofDetailIdx));

            ms_details.forEach(ms => {
                let needToAllocate = ms.flexallocated;
                log.debug('needToAllocate', needToAllocate);
                while (needToAllocate > 0) {

                    if (sofDetailList[sofDetailIdx] !== null && sofDetailList[sofDetailIdx] !== "" && sofDetailList[sofDetailIdx] !== undefined) { //Deepan : Sep 23,2021

                        let detailRec = record.load({
                            type: 'customrecord_ntx_so_finance_details',
                            id: sofDetailList[sofDetailIdx].id
                        });
                        let available = parseInt(detailRec.getValue('custrecord_ntx_so_fin_dts_quantity') || "0");
                        //let used = parseInt(detailRec.getValue('custrecord_ntx_so_fin_dts_qty_used') || "0");
                        //let available = quantity - used;
                        if (available == 0) {
                            sofDetailIdx++;
                        } else {
                            let toAllocate = needToAllocate;
                            if (available < needToAllocate) {
                                toAllocate = available;
                            }
                            let sofLineDetails = {};
                            sofLineDetails[sofDetailList[sofDetailIdx].id] = {
                                quantity_used: toAllocate,
                                quantity_remaining: available - toAllocate,
                                sof_header_id: sofDetailList[sofDetailIdx].sof_header_id,
                                sku_id: sofDetailList[sofDetailIdx].sku_id,
                                total_quan: sofDetailList[sofDetailIdx].total_quan,
                                percent_revenue: '', //sofDetailList[sofDetailIdx].percent_revenue
                                sf_order_line_id: sofDetailList[sofDetailIdx].sf_order_line_id,
                                linenum: sofDetailList[sofDetailIdx].linenum,
                                unitprice: sofDetailList[sofDetailIdx].unitprice
                            };

                            lib_flex_picker.updateSofLineRec(sofLineDetails, doId, ms.ms_id, toAllocate);
                            removeOldSofDetail(sofDetailList[sofDetailIdx].id);
                            //lib.createDOFlexAllocationRecord(doId, ms.ms_id, sofDetailList[sofDetailIdx].id, {quantity_used: toAllocate});
                            lib_expandMs.setCustLogistics(ms.ms_id, sofDetailList[sofDetailIdx].sof_header_id);
                            needToAllocate = needToAllocate - toAllocate;
                        }
                    }

                }
            });
        }

        // remove the parent flex sof detail record, the one that was assocaited with the ms being drawndown
        function removeOldSofDetail(sofDetailId) {
            let newParent = null;
            let newParentResults = search.lookupFields({
                type: 'customrecord_ntx_so_finance_details',
                id: sofDetailId,
                columns: ['custrecord_ntx_so_fin_dts_parent_flex_ln']
            }).custrecord_ntx_so_fin_dts_parent_flex_ln;
            if (newParentResults) {
                newParent = newParentResults[0].value;
            }

            log.debug('kgr parent id', sofDetailId);
            log.debug('kgr newparent id', newParent);

            let results = search.create({
                type: 'customrecord_ntx_so_finance_details',
                filters: [
                    ['custrecord_ntx_so_fin_dts_parent_flex_ln', 'anyof', sofDetailId]
                ],
                columns: [search.createColumn({
                    name: 'internalid'
                })]
            }).run().each(child => {
                log.debug('kgr child id', child.id);
                if (newParent) {
                    record.submitFields({
                        type: 'customrecord_ntx_so_finance_details',
                        id: child.id,
                        values: {
                            custrecord_ntx_so_fin_dts_parent_flex_ln: newParent
                        }
                    });
                }
            });

        }

        function pnvl(value, number) {
            if (number) {
                if (isNaN(parseFloat(value))) return 0;
                return parseFloat(value);
            }
            if (value == null) return '';
            return value;
        }


        function func_createMS_non_flex(_flds, total_ms_amt) {

            //name,suitelet_ms_id,  proj_id,sd,ed,serv_cat,flex_allocated
            var parentmsServiceItem = "";

            var name = _flds.final_name;
            var suitelet_ms_id = _flds.suitelet_ms_id;
            var proj_id = _flds.proj_id;
            var sd = _flds.firstDay;
            var ed = _flds.lastDay;
            var serv_cat = _flds.serv_cat;
            var prop_usecaseId = _flds.prop_usecaseId; //v2.2 - BA-74231
            var flex_allocated = _flds.flex_allocated;
            var parent_sd = _flds.parent_startdate;
            var parent_ed = _flds.parent_enddate;
            var _isNonBillableMSRecord = _flds.isNonBillableParentMSRec; //Added by Deepan on May 10
            //   _REV_DATE = parent_ed;
            var flex_unit_price = _flds.flex_unit_price;
            var soFinanceRecId = _flds.sofid;
            var ms_amt_for_month = '';

            var recObj = record.copy({
                type: record.Type.PROJECT_TASK,
                id: template_ms_id

            });
            log.audit(new Date(new Date().toDateString()) > new Date(ed), new Date(new Date().toDateString()) + "__" + new Date(ed) + "_" + name);
            var __msstatus = MS_STATUS_SCHEDULED;

            if (flex_allocated) {


                var __flex_cred_for_month = calc_prorate_flexcred(sd, ed);
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
                LAST_FLEX_MS_DETAILS = {}; //clear every time to store new details
                LAST_FLEX_MS_DETAILS.flexallocated = __flex_cred_for_month;
                LAST_FLEX_MS_DETAILS.flexunitprice = flex_unit_price;

                LAST_FLEX_MS_DETAILS.name = name;


            } else {
                ms_amt_for_month = calc_prorate_msamt(sd, ed);
            }
            if (new Date(new Date().toDateString()) > new Date(ed)) {

                __msstatus = MS_STATUS_RECOGNIZED;
                MS_STATUS_QUALIFIER_AUTO_RECOGNIZED = '';
                CHILD_ALLOCATED_FLEX = pnvl(CHILD_ALLOCATED_FLEX, true) + pnvl(__flex_cred_for_month, true);
            }
            log.audit('mstatus', __msstatus);
            //  throw suitelet_ms_id;
            recObj.setValue({
                fieldId: 'custevent_ntx_sl_parent_ms',
                value: suitelet_ms_id,
            });
            recObj.setValue({
                fieldId: 'custevent_ms_status',
                value: __msstatus,
            });
            recObj.setValue({
                fieldId: 'custevent_ms_status_qualifiers',
                value: MS_STATUS_QUALIFIER_AUTO_RECOGNIZED,
            });

            // if(name.toString().toLowerCase().indexOf('flex') ===-1)
            recObj.setValue({
                fieldId: 'custevent_service_category',
                value: serv_cat,
            });

            if (prop_usecaseId) { //v2.2 - BA-74231

                recObj.setValue({
                    fieldId: 'custevent_proposed_use_case',
                    value: prop_usecaseId,
                });

            }



            let percent_rev = 0;
            if (parseFloat(total_ms_amt) == 0) percent_rev = 0;
            else percent_rev = percentage_revenue(total_ms_amt, ms_amt_for_month)

            if (_isNonBillableMSRecord == false || _isNonBillableMSRecord == 'F') {
                recObj.setValue({
                    fieldId: 'custevent_milestone_amount',
                    value: ms_amt_for_month
                });
            }

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

            recObj.setValue({
                fieldId: 'title',
                value: name
            });
            recObj.setValue({
                fieldId: 'company',
                value: proj_id
            });

            // throw "flex "+flex_allocated;

            recObj.setValue({
                fieldId: 'custevent_ntx_sl_created_from_sl',
                value: true
            });


            recObj.setValue({ //Parent MS : Start Date
                fieldId: 'startdate',
                value: new Date(sd)
            });

            recObj.setValue({ //Parent MS : End Date
                fieldId: 'custevent_ntx_revenue_date',
                value: new Date(ed)
            });

            recObj.setValue({ //Child MS : Start Date
                fieldId: 'custevent_ntx_child_ms_start_date',
                value: new Date(sd)
            });

            recObj.setValue({ //Child MS : End Date
                fieldId: 'custevent_ntx_child_ms_end_date',
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

            //Set Customer/Logistics Fields

            if (suitelet_ms_id) {
                populateCustomerLogicInfoDetails(recObj, suitelet_ms_id);
            }

            if (soFinanceRecId) { //BA-89032

                var sofRecFieldsLookup = search.lookupFields({
                    type: 'customrecord_ntx_so_finance',
                    id: soFinanceRecId,
                    columns: ['custrecord_ntx_sof_strategic_deal']
                });

                if (sofRecFieldsLookup != null && sofRecFieldsLookup != "" && sofRecFieldsLookup != undefined) {
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

            //Added by Deepan on May 10
            if (_isNonBillableMSRecord == true || _isNonBillableMSRecord == 'T') {
                recObj.setValue({
                    fieldId: 'nonbillabletask',
                    value: true
                });

                recObj.setValue({
                    fieldId: 'custevent_milestone_amount',
                    value: 0.0
                });

                recObj.setValue({
                    fieldId: 'custevent_shadow_rev_ms',
                    value: ms_amt_for_month
                });
            }

            parentmsServiceItem = recObj.getValue('custevent_ntx_ms_serv_item');
            var parent_msid = recObj.save();

            //** for discrepancy
            if (flex_allocated) {
                LAST_FLEX_MS_DETAILS.ms_id = parent_msid;
            }
            //** for discrepancy
            log.debug('percent_rev', percent_rev)
            return {
                'parent_msid': parent_msid,
                'percent_rev': percent_rev,
                'skuid': parentmsServiceItem,//recObj.getValue('custevent_ntx_ms_serv_item'),
                'ms_amt': ms_amt_for_month,
                'non_billable_child_ms' : _isNonBillableMSRecord
            }

        }

        function populateCustomerLogicInfoDetails(recObj, suitelet_ms_id) {


            var parentMSFieldLookUp = search.lookupFields({
                type: search.Type.PROJECT_TASK,
                id: suitelet_ms_id,
                columns: ['custevent_ntx_ms_serv_item','custevent_ntx_so_finance_customer', 'custevent_ntx_ms_end_user', 'custevent_ntx_ms_cus_email', 'custevent_ntx_ms_cus_first_name', 'custevent_ntx_ms_cus_last_name',
                    'custevent_ntx_ms_cus_phone_num', 'custevent_ntx_ms_hypervisor', 'custevent_ntx_ms_install_street', 'custevent_ntx_ms_install_city', 'custevent_ntx_ms_install_state', 'custevent_ntx_ms__ins_postalcode', 'custevent_ntx_ms_install_cntry', 'custevent_ntx_ms_reseller_name', 'custevent_ntx_ms_disti_name', 'custevent_ntx_ms_disti_address', 'custevent_ntx_ms_est_ship_date', 'custevent_ntx_ms_actual_shpdate', 'custevent_ntx_ms_subregion',
                    'custevent_ntx_ms_region', 'custevent_ntx_ms_theater'
                ]
            });

            if (parentMSFieldLookUp) {

                if (parentMSFieldLookUp.custevent_ntx_ms_serv_item[0] && parentMSFieldLookUp.custevent_ntx_ms_serv_item[0].value) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_serv_item',
                        value: parentMSFieldLookUp.custevent_ntx_ms_serv_item[0].value
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_so_finance_customer[0] && parentMSFieldLookUp.custevent_ntx_so_finance_customer[0].value) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_so_finance_customer',
                        value: parentMSFieldLookUp.custevent_ntx_so_finance_customer[0].value
                    });
                }
                if (parentMSFieldLookUp.custevent_ntx_ms_end_user[0] && parentMSFieldLookUp.custevent_ntx_ms_end_user[0].value) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_end_user',
                        value: parentMSFieldLookUp.custevent_ntx_ms_end_user[0].value
                    });
                }
                if (parentMSFieldLookUp.custevent_ntx_ms_hypervisor[0] && parentMSFieldLookUp.custevent_ntx_ms_hypervisor[0].value) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_hypervisor',
                        value: parentMSFieldLookUp.custevent_ntx_ms_hypervisor[0].value
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_region[0] && parentMSFieldLookUp.custevent_ntx_ms_region[0].value) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_region',
                        value: parentMSFieldLookUp.custevent_ntx_ms_region[0].value
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_theater[0] && parentMSFieldLookUp.custevent_ntx_ms_theater[0].value) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_theater',
                        value: parentMSFieldLookUp.custevent_ntx_ms_theater[0].value
                    });
                }
                if (parentMSFieldLookUp.custevent_ntx_ms_cus_email) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_cus_email',
                        value: parentMSFieldLookUp.custevent_ntx_ms_cus_email
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_cus_first_name) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_cus_first_name',
                        value: parentMSFieldLookUp.custevent_ntx_ms_cus_first_name
                    });
                }


                if (parentMSFieldLookUp.custevent_ntx_ms_cus_last_name) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_cus_last_name',
                        value: parentMSFieldLookUp.custevent_ntx_ms_cus_last_name
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_cus_phone_num) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_cus_phone_num',
                        value: parentMSFieldLookUp.custevent_ntx_ms_cus_phone_num
                    });
                }


                if (parentMSFieldLookUp.custevent_ntx_ms_install_street) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_install_street',
                        value: parentMSFieldLookUp.custevent_ntx_ms_install_street
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_install_city) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_install_city',
                        value: parentMSFieldLookUp.custevent_ntx_ms_install_city
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_install_state) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_install_state',
                        value: parentMSFieldLookUp.custevent_ntx_ms_install_state
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms__ins_postalcode) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms__ins_postalcode',
                        value: parentMSFieldLookUp.custevent_ntx_ms__ins_postalcode
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_install_cntry) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_install_cntry',
                        value: parentMSFieldLookUp.custevent_ntx_ms_install_cntry
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_reseller_name) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_reseller_name',
                        value: parentMSFieldLookUp.custevent_ntx_ms_reseller_name
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_disti_name) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_disti_name',
                        value: parentMSFieldLookUp.custevent_ntx_ms_disti_name
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_disti_address) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_disti_address',
                        value: parentMSFieldLookUp.custevent_ntx_ms_disti_address
                    });
                }


                if (parentMSFieldLookUp.custevent_ntx_ms_est_ship_date) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_est_ship_date',
                        value: new Date(parentMSFieldLookUp.custevent_ntx_ms_est_ship_date)
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_actual_shpdate) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_actual_shpdate',
                        value: new Date(parentMSFieldLookUp.custevent_ntx_ms_actual_shpdate)
                    });
                }

                if (parentMSFieldLookUp.custevent_ntx_ms_subregion) {
                    recObj.setValue({
                        fieldId: 'custevent_ntx_ms_subregion',
                        value: parentMSFieldLookUp.custevent_ntx_ms_subregion
                    });
                }



            }

            //return recObj;
        }

        function getCurrentQtrYear(dt) {

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


        function StoreGlobalValuesforProjectTasks(template_search) {
            var template_search_res = search.load({
                id: template_search
            });
            var searchResult = template_search_res.run().getRange({
                start: 0,
                end: 20
            });
            //throw searchResult.count;
            for (var i = 0; searchResult && i < searchResult.length; i++) {
                // searchResult.each(function(result){
                var result = searchResult[i];
                //  var _msid = result.id;

                var _title = result.getValue({
                    name: 'formulatext'
                });
                var proj_task_id = result.getValue({
                    name: 'internalid',
                    join: 'projectTask'
                });
                var is_ms = result.getValue({
                    name: "custevent_ntx_is_milestone",
                    join: 'projectTask'
                });
                if (is_ms == true) {
                    template_ms_id = proj_task_id;
                }

            }


        }
        function getSOFID(suitelet_ms_id) {
            let results = search.create({
                type: 'customrecord_ntx_so_flex_allocation',
                filters: [
                    ['custrecord_ntx_so_flex_alloc_fin_rel_ms', 'anyof', suitelet_ms_id]
                ],
                columns: [
                    search.createColumn({
                        name: 'formulatext',
                        formula: '{custrecord_ntx_so_flex_alloc_fin_detail.custrecord_ntx_so_fin_dts_header.id}'
                    })
                ]
            }).run().getRange({
                start: 0,
                end: 1
            });
            if (results && results.length > 0) {
                return results[0].getValue(results[0].columns[0]);
            }
            return '';
        }


        function Create_records_for_dates_non_flex(_flds_for_rec, total_ms_amt) {

            var __startdate = _flds_for_rec.startdate;
            var __enddate = _flds_for_rec.enddate;
            var suitelet_ms_id = _flds_for_rec.suitelet_ms_id;
            var name = _flds_for_rec.name;
            var proj_id = _flds_for_rec.proj_id;
            var serv_cat = _flds_for_rec.serv_category;
            var prop_usecaseId = _flds_for_rec.proposed_usecase; //v2.2 - BA-74231
            var flex_allocated = _flds_for_rec.flex_allocated;
            var flex_unit_price = _flds_for_rec.flex_unit_price;
            var resourceId = _flds_for_rec.resource_id;
            var sofid = _flds_for_rec.sofid;
            var __nonBillalableParentMS = _flds_for_rec.isNonBillableParentMS;
            var sfdcOrderLineId =   _flds_for_rec.sf_orderLine_id;
            var nsSOLineId = _flds_for_rec.so_line_id;
            var atRisk_SOF_Item_Qty = _flds_for_rec.at_risk_ms_sof_item_qty;
            var _milestoneAmount = _flds_for_rec.milestone_amt;//0,
            var _milestoneShadowRevenueAmount = _flds_for_rec.shadow_revenue_amt;

            if (!sofid) {
                sofid = getSOFID(suitelet_ms_id)
            }
            var date = new Date(__startdate);

            var enddate = new Date(__enddate);
            var mon_diff = monthDiff(date, enddate); // lib_expandMs.getNumberOfDays
            var totalDays = lib_expandMs.getNumberOfDays(date, enddate);
            var ii = mon_diff;

            var firstDay = date;
            var lastDay = '';
            var arr_msdetails = [];

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
                _flds.suitelet_ms_id = suitelet_ms_id;
                _flds.proj_id = proj_id;
                _flds.firstDay = firstDay;
                _flds.lastDay = lastDay;
                _flds.serv_cat = serv_cat;
                _flds.prop_usecaseId = prop_usecaseId; //v2.2 - BA-74231
                _flds.flex_allocated = flex_allocated;
                //throw flex_allocated;
                _flds.parent_startdate = __startdate;
                _flds.parent_enddate = __enddate;
                _flds.flex_unit_price = flex_unit_price;
                _flds.sofid = sofid;
                _flds.isNonBillableParentMSRec = __nonBillalableParentMS;

                var _ms_details = func_createMS_non_flex(_flds, total_ms_amt);
                log.debug('_ms_details', JSON.stringify(_ms_details));
                var parent_msid = _ms_details.parent_msid;
                if (_flds_for_rec.newRec) {
                    log.debug('json string', JSON.stringify(_flds_for_rec.newRec));
                    var fraction = lib_expandMs.getNumberOfDays(firstDay, lastDay) / totalDays;
                    lib_flex_picker.createEffortHours(parent_msid, _flds_for_rec.newRec, fraction,ii);
                }
                var __obj = {
                    'msid': parent_msid,
                    'percent_rev': _ms_details.percent_rev,
                    'skuid': _ms_details.skuid,
                    'projid': proj_id,
                    'ms_amt': _ms_details.ms_amt,
                    'sofid': sofid,
                    'nonbillable_ms_rec' : __nonBillalableParentMS
                }
                arr_msdetails.push(__obj);
                // return{'parent_msid': parent_msid,
                //                 'percent_rev':percent_rev,'skuid':parentmsServiceItem}

                log.debug('***MCF-Results***', 'MSId: ' + parent_msid + ',Resource Id: ' + resourceId);
                if (parent_msid && resourceId) {

                    var resourceAllocationId = lib_expandMs.createResourceAllocation(proj_id, parent_msid, resourceId, firstDay, lastDay);

                    if (resourceAllocationId)
                        log.debug('Resource Allocation saved successfully: ', resourceAllocationId);

                }

                // end of creating ms & proj tasks
                date = new Date(date.getFullYear(), date.getMonth() + 1);
                //alert(date);
                ii--;


            }
            while (ii >= 0)
            //loop for
            log.debug('creating sof records');
            arr_msdetails.forEach(function(arrayItem) {
                let sofid = arrayItem.sofid;
                let ms_amt = arrayItem.ms_amt;
                let percent_rev = arrayItem.percent_rev;
                let msid = arrayItem.msid;
                let skuid = arrayItem.skuid;
                let isNonBillableChildMilestone = arrayItem.nonbillable_ms_rec;

                nonflex_createSOFDetail(sofid, proj_id, ms_amt, percent_rev, msid, skuid, sfdcOrderLineId, nsSOLineId, atRisk_SOF_Item_Qty, isNonBillableChildMilestone);
            });

            log.debug('__nonBillalableParentMS-1: ',__nonBillalableParentMS + ',_milestoneAmount: ' + _milestoneAmount + ',_milestoneShadowRevenueAmount: ' + _milestoneShadowRevenueAmount);
//remove parent ms after expansion only for regular ms
            if((__nonBillalableParentMS != true && __nonBillalableParentMS != 'T') &&
                (_milestoneAmount && parseFloat(_milestoneAmount)>0))
                removeParentFlexSOFDetailrecords(suitelet_ms_id);


        }

        function nonflex_createSOFDetail(sofid, proj_id, ms_amt, percent_rev, msid, skuid, sfdcOrderLineId, nsSOLineId, atRisk_SOF_Item_Qty, isNonBillableChildMilestone) {

            var sofDetailRecObj = record.create({
                type: 'customrecord_ntx_so_finance_details',
                isDynamic: true
            });

            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_do', proj_id);
            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_header', sofid); // set milestone id
            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_amount', ms_amt);
            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_item', skuid);

            if(sfdcOrderLineId)
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_sf_ord_line_id', sfdcOrderLineId);

            if(nsSOLineId)
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_so_line_id', nsSOLineId);

            if(isNonBillableChildMilestone == true || isNonBillableChildMilestone == 'T'){ //Added by Deepan on Aug 8,2022

                sofDetailRecObj.setValue('custrecord_ntx_sofd_rel_at_risk_ms_id', msid);

                if(atRisk_SOF_Item_Qty)
                    sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_quantity', parseInt(atRisk_SOF_Item_Qty));
            }

            var sofDetailRecId = sofDetailRecObj.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            nonflex_createDo_alloc(sofDetailRecId, proj_id, msid, percent_rev, ms_amt, skuid);
        }

        function nonflex_createDo_alloc(sofDetailRecId, proj_id, msid, percent_rev, ms_amt, skuid) {
            var doAllocationRecObj = record.create({
                type: 'customrecord_ntx_so_flex_allocation',
                isDynamic: true
            });

            doAllocationRecObj.setValue('custrecord_ntx_so_flex_alloc_fin_rel_ms', msid);
            doAllocationRecObj.setValue('custrecord_ntx_so_flex_alloc_fin_do_link', proj_id);
            doAllocationRecObj.setValue('custrecord_ntx_so_flex_alloc_fin_detail', sofDetailRecId); // set milestone id

            doAllocationRecObj.setValue('custrecord_ntx_so_fin_dts_item', skuid); //parentId
            //  log.audit('Typeof Percent: ',typeof percent_rev);
            if (percent_rev == null || !percent_rev) percent_rev = 0;
            log.audit('percent', percent_rev);

            doAllocationRecObj.setValue('custrecord_ntx_so_flex_alloc_perc_skurev', parseFloat(percent_rev));

            var doAllocRecId = doAllocationRecObj.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });
            log.audit('created alloc record', doAllocRecId);
        }

        function percentage_revenue(totalamt, msamt) {
            log.audit('calc per', totalamt + ":::" + msamt);
            if (parseFloat(totalamt) == 0) return 0;
            let percent = (parseFloat(msamt) / parseFloat(totalamt)) * 100;
            percent = Math.round(percent, 2);
            log.audit('test', percent);
            if (!percent) percent = 0;
            return percent;
        }

        function monthDiff(startdate, enddate) {
            dateFrom = new Date(startdate);
            dateTo = new Date(enddate);
            return dateTo.getMonth() - dateFrom.getMonth() +
                (12 * (dateTo.getFullYear() - dateFrom.getFullYear()))
        }
        ////******************************
        function calc_singledayamt(sd, ed, totalamt) {
            sd = new Date(sd);
            ed = new Date(ed);
            var Difference_In_Time = ed.getTime() - sd.getTime();
            var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
            Difference_In_Days = Difference_In_Days + 1;
            PER_DAY_AMT = totalamt / Difference_In_Days;


        }

        function calc_singledayflexcred(sd, ed, flexcred) {
            sd = new Date(sd);
            ed = new Date(ed);
            var Difference_In_Time = ed.getTime() - sd.getTime();
            var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
            Difference_In_Days = Difference_In_Days + 1;
            PER_DAY_CRED = flexcred / Difference_In_Days;


        }
        //**************************************************
        ////_____________________________________________
        function calc_prorate_msamt(sd, ed) {
            sd = new Date(sd);
            ed = new Date(ed);
            var Difference_In_Time = ed.getTime() - sd.getTime();
            var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
            Difference_In_Days = Difference_In_Days + 1;
            //throw PER_DAY_AMT + ":::"+Difference_In_Days;
            return Difference_In_Days * PER_DAY_AMT;
        }

        function calc_prorate_flexcred(sd, ed) {
            sd = new Date(sd);
            ed = new Date(ed);
            var Difference_In_Time = ed.getTime() - sd.getTime();
            var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
            Difference_In_Days = Difference_In_Days + 1;
            //throw PER_DAY_AMT + ":::"+Difference_In_Days;
            var flexcred = Math.round(Difference_In_Days * PER_DAY_CRED);
            AUTOMATED_ASSIGNED_FLEX = AUTOMATED_ASSIGNED_FLEX + flexcred;
            return flexcred;
        }

        function removeParentFlexSOFDetailrecords(flexMsId) {
            let testSearch = search.load({
                id: 'customsearch_get_flexms_from_sofdetail' //14685
            });
            let filters = testSearch.filters;
            let filterOne =
                search.createFilter({
                    name: "custrecord_ntx_so_flex_alloc_fin_rel_ms",
                    join: "custrecord_ntx_so_flex_alloc_fin_detail",
                    operator: 'ANYOF',
                    values: flexMsId
                });
            filters.push(filterOne);
            log.debug('len', testSearch.run().getRange(0, 1000).length);
            testSearch.run().each(function(result) {
                let doAllocId = result.getValue({
                    name: "internalid",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL"
                });
                let sofHeaderId = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_header"
                });
                log.debug('in search', doAllocId + "::" + sofHeaderId + "::" + result.id)
                try {
                    record.delete({
                        type: 'customrecord_ntx_so_flex_allocation',
                        id: doAllocId
                    });
                    record.delete({
                        type: 'customrecord_ntx_so_finance_details',
                        id: result.id
                    });
                } catch (e) {
                    log.error('error while deleting allc/detail record', e)
                }
                return true;
            });
        }

        function getParentMSSOFDetailValues(parentMSId){

            let sofDetailValues = [];
            let __sfOrderLineId = null;
            let __soLineId = null;
            let __atRiskSOFItemQuantity = null; //Added by Deepan on Aug 8,2022

            let parentMSSOFDetailsSearchObj = search.load({
                id: 'customsearch_ntx_get_parent_ms_sofdetail'
            });

            let __filters = parentMSSOFDetailsSearchObj.filters;

            let __filterOne =
                search.createFilter({
                    name: "custrecord_ntx_so_flex_alloc_fin_rel_ms",
                    operator: 'ANYOF',
                    values: parentMSId
                });
            __filters.push(__filterOne);

            parentMSSOFDetailsSearchObj.run().each(function(result) {

                __sfOrderLineId = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_sf_ord_line_id",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    summary: "GROUP"
                });

                __soLineId = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_so_line_id",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    summary: "GROUP"
                });

                __atRiskSOFItemQuantity = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_quantity",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    summary: "GROUP"
                });

                return true;
            });

            sofDetailValues[0] = __sfOrderLineId;
            sofDetailValues[1] = __soLineId;
            sofDetailValues[2] = __atRiskSOFItemQuantity;

            return sofDetailValues;

        }

        return {
            execute: execute
        };

    });