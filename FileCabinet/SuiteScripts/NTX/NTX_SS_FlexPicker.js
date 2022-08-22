/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define([ 'N/search', 'N/record', 'N/runtime',
        '/SuiteScripts/NTX/NTX_Lib_Estimated_Effort_Hours_MS_Project_SSV2',
        '/SuiteScripts/NTX/NTX_Lib_FlexPicker.js', '/SuiteScripts/NTX/NTX_lib_expandms_2.1',
        '/SuiteScripts/DeliveryObject/NTX_SOFManager.js'
    ],

    ( search, record, runtime, libestimatedhrs, lib, lib_expandMs, sofMgr) => {


        const execute = (scriptContext) => {
            try {
                var scriptObj = runtime.getCurrentScript();

                let picker_id = scriptObj.getParameter({
                    name: 'custscript_ntx_picker_id'
                });
            //    let picker_id = '';
                let newRec = record.load({
                    type: 'customrecord_ntx_do_flex_picker',
                    id: picker_id
                });
                let newUnitPrice = scriptObj.getParameter({
                    name: 'custscript_ntx_new_unit_price'
                });//get from parameter
                let calculatedFlexCredits_ForMs = newRec.getValue('custrecord_ntx_do_req_flex');//get from newrec
                let customerId = newRec.getValue('custrecord_ntx_do_customer');//get from newrec
                // let newRec = scriptContext.newRecord;
                let singleDayCred =  scriptObj.getParameter({
                    name: 'custscript_ntx_single_day_cred'
                });//param
                let doId = newRec.getValue('custrecord_ntx_do_postcal_used_proj'); //param


                let obj_sofQuanDetails =  newRec.getValue('custrecord_ntx_do_obj_sof_details');//get from newrec
                obj_sofQuanDetails =JSON.parse(obj_sofQuanDetails);
                let sku_id = obj_sofQuanDetails[Object.keys(obj_sofQuanDetails)[0]].sku_id;
                log.debug('obj_sofQuanDetails',obj_sofQuanDetails);
                log.debug('testing', calculatedFlexCredits_ForMs +"   "+singleDayCred+"   "+newUnitPrice+"  "+doId);
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
                let obj = {

                    'custrecord_ntx_do_postcal_used_ms':lastMilestone.ms_id,
                    'custrecord_ntx_do_obj_sof_details':'',

                }

                lib.updatePickerRecord(obj, newRec); //do picker

                    lib.updateDOName(doId, customerId, newRec);

            } catch (e) {
                if (e.toString().indexOf('DO PROJECT:') > -1)
                    throw e;
                log.debug('error', e);
            }
        }
        const createSOFRecords = (obj_sofQuanDetails, ms_details, doId) => {
            //put into a list to make it easier
            let sofDetailList = [];
            log.debug('create sof', JSON.stringify(obj_sofQuanDetails));
            for (let sofDetailId in obj_sofQuanDetails) {
                let sofDetails = obj_sofQuanDetails[sofDetailId];
                sofDetails.id = sofDetailId;
                sofDetailList.push(sofDetails);
            }
            let sofDetailIdx = 0;
            log.debug('sofDetailIdx', JSON.stringify(sofDetailIdx));
            log.debug('ms_details', ms_details.toString());
            ms_details.forEach(ms => {
                let needToAllocate = ms.flexallocated;
                log.debug('needToAllocate', needToAllocate);
                while (needToAllocate > 0) {
                    log.debug('sofDetailList[sofDetailIdx].id', sofDetailList[sofDetailIdx].id)
                    if (sofDetailList[sofDetailIdx].id) {
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

                            log.debug('sofLineDetails', JSON.stringify(sofLineDetails))
                            lib.updateSofLineRec(sofLineDetails, doId, ms.ms_id, toAllocate);

                           lib.updateFlexMs(sofDetailList[sofDetailIdx].sof_header_id, ms.ms_id);
                            //lib.createDOFlexAllocationRecord(doId, ms.ms_id, sofDetailList[sofDetailIdx].id, {quantity_used: toAllocate});
                            lib_expandMs.setCustLogistics(ms.ms_id, sofDetailList[sofDetailIdx].sof_header_id);
                            needToAllocate = needToAllocate - toAllocate;
                        }
                    }
                }
            });
        }


        return {execute}

    });
