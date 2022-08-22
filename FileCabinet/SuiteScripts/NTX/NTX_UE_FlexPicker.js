/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/*
 * version 				date							author 			remarks
 * V1.0				        31 May,2021          Shobiya      Delivery Order Process
 * V2.0    					19 Aug,2021          Deepan      BA-82810: EDU Task/MS Sync in DO Architecture
 * v3.0   					2021-12-16           Kenneth     BA-84800 Create Flex Dashboard for Each SKU in SOF
 * v4.0 					2022-02-25 			Kenneth	  BA-88200  Create $0 Approval Group Field in SOF and MS
 * v5.0                     2022-04-26    		Deepan 	  BA-89032 Strategic Deal value not populated in SKU based milestones
 * v5.1      				2022-07-21			Kenneth BA-90435 Flex Picker and Expand Flex Credits Allow Choice of SF Order Line ID*
 * */
define(['N/ui/serverWidget', 'N/search', 'N/record', 'N/runtime', 'N/format',
        '/SuiteScripts/NTX/NTX_Lib_Estimated_Effort_Hours_MS_Project_SSV2',
        '/SuiteScripts/NTX/NTX_Lib_FlexPicker.js', '/SuiteScripts/NTX/NTX_lib_expandms_2.1',
        '/SuiteScripts/DeliveryObject/NTX_SOFManager.js', 'N/https', 'N/url', 'N/task'
    ],
    (serverWidget, search, record, runtime, format, libestimatedhrs, lib, lib_expandMs, sofMgr, https, url, task) => {

        const EDUCATION = 2;

        const beforeLoad = scriptContext => {

            let params = scriptContext.request;
            const type = scriptContext.type;
            const form = scriptContext.form;
            log.debug('test');


            form.clientScriptModulePath = "SuiteScripts/NTX/NTX_CS_FlexPicker.js";

            let rec = scriptContext.newRecord;
            let _custId = '';
            let _formId = '';

            if (params) {
                params = params.parameters;
                _custId = params.customerId;

                _formId = params.cf;
            }
            if (_custId) {
                rec.setValue('custrecord_ntx_do_customer', _custId)
            }
            if (type == 'create') {


                var existing_sof_fld = form.addField({
                    id: 'custpage_choose_sof',
                    type: 'select',
                    label: 'Existing SOF'
                });
                existing_sof_fld.updateLayoutType({
                    layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
                });

                let sofList = GetSOFs(_custId);
                existing_sof_fld.addSelectOption({
                    value: '',
                    text: ''
                });

                sofList.each(function (holdoption) {

                    var label = holdoption.getValue({
                        name: "name",
                        summary: "GROUP",
                        label: "Name"
                    });
                    var headerId = holdoption.getValue({
                        name: "internalid",
                        summary: "GROUP",
                        label: "Internal ID",
                        sort: search.Sort.DESC
                    });
                    existing_sof_fld.addSelectOption({
                        value: headerId,
                        text: label
                    });

                    return true;
                });

                const flex_line_fld = form.addSublist({
                    id: 'custpage_choose_flex_line',
                    type: serverWidget.SublistType.INLINEEDITOR,
                    label: 'Choose Flex Line'

                });
                flex_line_fld.addField({
                    id: 'lineid_select',
                    label: 'select',
                    type: serverWidget.FieldType.CHECKBOX,
                })
                flex_line_fld.addField({
                    id: 'lineid',
                    label: 'SO Line',
                    type: serverWidget.FieldType.INTEGER,
                })

                flex_line_fld.addField({
                    id: 'available_flex',
                    label: 'Available Flex',
                    type: serverWidget.FieldType.INTEGER,
                });
                flex_line_fld.addField({
                    id: 'flex_price',
                    label: 'Flex Price',
                    type: serverWidget.FieldType.CURRENCY,
                });
            }

            // if(type =='create'){
            form.addButton({
                id: 'custpage_btn_do_preview',
                label: 'Preview',
                functionName: 'preview'
            });
            // }
            if (type == 'view') {

                //create an inline html field
                var hideFld = scriptContext.form.addField({
                    id: 'custpage_hide_buttons',
                    label: 'not shown - hidden',
                    type: 'inlinehtml'
                });
                //for every button you want to hide, modify the scr += line
                var scr = "";
                scr += 'jQuery("#recmachcustrecord_ef_flex_picker_main_form").hide();';
                // scr += 'jQuery("#attach").hide();';
                //push the script into the field so that it fires and does its handy work
                hideFld.defaultValue = "<script>jQuery(function($){require([], function(){" + scr + "})})</script>"
            }
        }
        const GetSOFs = (customerID) => {

            var customrecord_ntx_so_finance_detailsSearchObj = search.create({
                type: "customrecord_ntx_so_finance",
                filters: [
                    ["custrecord_ntx_so_fin_dts_header.custrecord_ntx_so_fin_dts_item", "anyof", "197438"],
                    "AND",
                    ["name", "isnot", "inactive"],
                    "AND",
                    ["custrecord_ntx_so_fin_dts_header.custrecord_ntx_so_fin_dts_do", "anyof", "@NONE@"],
                    "AND",
                    ["isinactive", "is", "F"],
                    "AND",
                    ["custrecord_ntx_so_fin_dts_header.custrecord_ntx_so_fin_dts_quantity", "greaterthan", "0"],
                    "AND",
                    ["custrecord_ntx_so_finance_end_user", "anyof", customerID],
                    "AND",
                    ["custrecord_ntx_so_finance_credits_price", "greaterthan", "0.00"]
                ],
                columns: [
                    search.createColumn({
                        name: "name",
                        summary: "GROUP",
                        label: "Name",
                        sort: search.Sort.ASC
                    }), search.createColumn({
                        name: "internalid",
                        summary: "GROUP",
                        label: "Internal ID"
                    })
                ]
            });


            return customrecord_ntx_so_finance_detailsSearchObj.run();
        }

        const afterSubmit = (scriptContext) => {
            try {
//removefrom scheduled script context
                let newRec = scriptContext.newRecord;
                let customerId = newRec.getValue('custrecord_ntx_do_customer');
                let revenueAmt = newRec.getValue('custrecord_ntx_do_req_revenue');
                let requiredFlex = newRec.getValue('custrecord_ntx_do_req_flex');
                let existingDO = newRec.getValue('custrecord_ntx_do_existing_so');

                let sd = newRec.getValue('custrecord_ntx_expandms_startdate');
                let ed = newRec.getValue('custrecord_ntx_expandms_enddate');

                let sofHeaderId = newRec.getValue('custrecord_ntx_do_existing_sof');
                let sofSOLindId = newRec.getValue('custrecord_ntx_do_existing_sof_line');
                let customerCanAfford = lib.getTotalExistingAmtForCustomer(customerId, sofHeaderId);
                log.debug('can afford', customerCanAfford);
                if (parseFloat(customerCanAfford) < parseFloat(revenueAmt)) {
                    throw 'Flex is not enough. Please adjust revenue amount. Customer have only flex worth of ' + customerCanAfford;
                    return;
                }
                log.debug('customer have flex');
                let searchResult = lib.runSearch(customerId, sofHeaderId, sofSOLindId);
                let obj_toUse_Flex_Amt = lib.calculate_toUse_Flex_Amt(searchResult, revenueAmt, null, requiredFlex);


                log.debug('obj_toUse_Flex_Amt', JSON.stringify(obj_toUse_Flex_Amt));
                let calculatedFlexCredits_ForMs = requiredFlex; //obj_toUse_Flex_Amt.flex;
                let calculatedMsAmount_ForMs = obj_toUse_Flex_Amt.msamount;
                let recentSO_ForMs = obj_toUse_Flex_Amt.recentSO;
                log.debug('so for ms', recentSO_ForMs);
                let obj_sofQuanDetails = obj_toUse_Flex_Amt.obj_sofDetailsId;
                if (!sd && !ed) {
                    let _flexReservation = newRec.getValue('custrecord_ntx_do_flex_reserv');
                    let doId = lib.create_DO_ForFlex(calculatedFlexCredits_ForMs, calculatedMsAmount_ForMs, newRec, recentSO_ForMs); //creates one do
                    if (doId) {
                        let flexMsId = '';
                        log.debug('projid', doId);
                        flexMsId = lib.create_MS_ForFlex(calculatedMsAmount_ForMs, calculatedFlexCredits_ForMs, newRec, doId, _flexReservation, recentSO_ForMs);

                        log.debug('msid', flexMsId);
                        if (flexMsId) {
                            lib.createEffortHours(flexMsId, newRec);
                            log.debug('calling do');
                            try {
                                libestimatedhrs.CalEstEftProject(flexMsId, runtime.executionContext, true); //deepn to work on this
                            } catch (e) {
                                log.error('error while creating effort hrs', e);
                            }
                            /*update existing parent sof lines with remaining quan
                            create new sof detail record with do & link to header
                            create new do allocation record under each sof detail record with allocated quantity
                             */
                            let arr_sof_headerID = lib.updateSofLineRec(obj_sofQuanDetails, doId, flexMsId, calculatedFlexCredits_ForMs, calculatedMsAmount_ForMs);
                            log.debug('arr_sof_headerID', arr_sof_headerID.toString())
                            lib.updateSofHeader(arr_sof_headerID);
                            let obj = {
                                'custrecord_ntx_do_postcal_used_proj': doId,
                                'custrecord_ntx_do_postcal_used_ms': flexMsId,
                                'custrecord_ntx_do_postcal_revenue': parseFloat(obj_toUse_Flex_Amt.msamount),
                                'custrecord_ntx_do_postcal_flexcred': parseFloat(obj_toUse_Flex_Amt.flex)
                            }
                            lib.updatePickerRecord(obj, newRec); //do picker

                            lib.updateFlexMs(arr_sof_headerID[arr_sof_headerID.length - 1], flexMsId);

                            //Trigger EDU Project Creation Script
                            updateEDU(existingDO, doId, customerId, newRec, flexMsId);

                        }
                    }
                } else {
                    let singleDayCred = lib_expandMs.calc_singledayflexcred(sd, ed, calculatedFlexCredits_ForMs);
                    log.audit('single day cred', singleDayCred);
                    if (parseFloat(singleDayCred) < 1) {
                        //   throw "DO PROJECT: not enough credits to distribute. Increase required flex";
                    }
                    //lib.expandMsFeature(sd,ed,calculatedFlexCredits_ForMs);
                    let newUnitPrice = parseFloat(calculatedMsAmount_ForMs) / parseFloat(calculatedFlexCredits_ForMs);

                    let doId = lib.create_DO_ForFlex(calculatedFlexCredits_ForMs, calculatedMsAmount_ForMs, newRec, recentSO_ForMs); //creates one do
                    let obj = {
                        'custrecord_ntx_do_postcal_used_proj': doId,

                        'custrecord_ntx_do_postcal_revenue': parseFloat(obj_toUse_Flex_Amt.msamount),
                        'custrecord_ntx_do_postcal_flexcred': parseFloat(obj_toUse_Flex_Amt.flex),
                        'custrecord_ntx_do_obj_sof_details': JSON.stringify(obj_sofQuanDetails)
                    }
                    lib.updatePickerRecord(obj, newRec); //do picker
                    let __params = {
                        'custscript_ntx_picker_id': newRec.id,
                        'custscript_ntx_new_unit_price': newUnitPrice,
                        'custscript_ntx_single_day_cred': singleDayCred
                    };
                    schedule_to_create_task(__params);


                    //  lib.updatePickerRecord(doId, '', obj_toUse_Flex_Amt, newRec); //do picker
                    // the skus should all be the same
                    /*let sku_id = obj_sofQuanDetails[Object.keys(obj_sofQuanDetails)[0]].sku_id;
                    // let totalDaysOverall = lib_expandMs.getNumberOfDays(sd,ed);
                    //	 let actualFlexDifference =Math.round((parseFloat(totalDaysOverall)*parseFloat(singledaycred)))- parseFloat(calculatedFlexCredits_ForMs);
                    let ms_details = lib_expandMs.convert_Create_records_for_dates(newRec, newUnitPrice, calculatedFlexCredits_ForMs, singleDayCred, doId, sku_id);


                    let lastMilestone = ms_details[ms_details.length - 1]
                    let lastmsid = lastMilestone.lastmsid;
                    let totalcreds = lastMilestone.totalcreds;
                    let unitprice = lastMilestone.flexunitprice;
                    let delta = (calculatedFlexCredits_ForMs - totalcreds);

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

                    createSOFRecords(obj_sofQuanDetails, ms_details, doId);
                    log.debug('updating picker record');
                    lib.updatePickerRecord(doId, lastMilestone.ms_id, obj_toUse_Flex_Amt, newRec); //do picker
                    updateDOName(doId, customerId, newRec);*/
                }
            } catch (e) {
                if (e.toString().indexOf('DO PROJECT:') > -1)
                    throw e;
                log.debug('error', e);
            }
        }
        const schedule_to_create_task = (__params) => {

            var scriptTask = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: 'customscript_ntx_ss_flexpicker_create_ms',

                params: __params
            });
            let taskId = scriptTask.submit();
            log.debug('Rescheduling task');
        }


        const updateEDU = (existingDO, doId, customerId, newRec, flexMsId) => {
            let _serviceCategoryId = newRec.getValue('custrecord_ntx_do_service_category');
            if (_serviceCategoryId == EDUCATION || (!existingDO)) {
                log.debug('updateing do id', doId);
                lib.updateDOName(doId, customerId, newRec);
                if (_serviceCategoryId == EDUCATION && flexMsId) {
                    var suiteletURLOutput = url.resolveScript({
                        scriptId: 'customscript_ntx_sl_tri_edu_serv_sync_pr',
                        deploymentId: 'customdeploy_ntx_sl_tri_edu_serv_sync_pr',
                        returnExternalUrl: true,
                        params: {
                            flex_ms_id: flexMsId
                        }
                    });

                    log.debug('SuiteletURLOutput: ', suiteletURLOutput);

                    var headerObj = {
                        name: 'Accept-Language',
                        value: 'en-us'
                    };
                    var suiteletResponse = https.post({
                        url: suiteletURLOutput,
                        body: 'Trigger Services and EDU Project Sync Process',
                        headers: headerObj
                    });

                    log.debug('SuiteletResponse: ', suiteletResponse);
                }
            }
        }


        return {
            beforeLoad,
            afterSubmit
        }
        //   return { afterSubmit}
    });
