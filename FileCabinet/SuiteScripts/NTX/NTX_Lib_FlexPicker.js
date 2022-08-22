/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
/*
 * version              date                     author           remarks
 * V1.0                     31 May,2021          Shobiya      Delivery Order Process
 * V2.0                    19 Aug,2021          Deepan      BA-82810: EDU Task/MS Sync in DO Architecture
 * V2.1                    22 Sep,2021          Deepan      BA-81442 Have Resident resource assigned on automated MS Expansion
 * V2.2    					22 Dec,2021          Kenneth     BA-84800 Create Flex Dashboard for Each SKU in SOF*
 *v3.0				march 10 22			shobiya BA-89136
Flex Picker failing to Link MS to SOF
v3.1		june 16 22			shobiya BA-90985
v3.2        Jul 18 22			Kenneth BA-90211 Update Flex Picker calculations for Line Item ID
v3.3        Jul 21 22			Kenneth BA-90435 Flex Picker and Expand Flex Credits Allow Choice of SF Order Line ID
  3.4		shobiya.  			july 28 22 BA-86838 Fix MS Expansion to distribute the LOE of Parent across Children
 *4.0       shobiya aug 9 22 BA-86838
 * */
define(['N/runtime', 'N/log', 'N/record', 'N/search', 'N/url', 'N/ui/message',
        'N/currentRecord', 'N/format', './NTX_Lib_Estimated_Effort_Hours_MS_Project_SSV2'
    ],

    function(runtime, log, record, search, url, message, currentRecord, format, estCalcLib) {

        // log.debug('searchids', searchId +"::"+search_customerCanAfford);
        const FLEX_ITEM = 197438;
        const CUSTOMER_NOT_READY = 2;
        const UNDEFINED_FLEXCREDIT_USE = 12;
        const EDUCATION = 2;

        const numberIsDecimal = (num) => {
            return num % 1 != 0;
        }
        const cleanupSoName = (so_number) => {
            return so_number.toString().replace("Sales Order #", '');
        }

        const getTotalExistingAmtForCustomer = (customerId, sofId) => {
            let scriptObj = runtime.getCurrentScript();

            let search_customerCanAfford = scriptObj.getParameter({
                name: 'custscript_ntx_check_customer_can_afford'
            });

            let mySearch = search.load({
                id: search_customerCanAfford
            });
            let filters = mySearch.filters;
            let filterOne =
                search.createFilter({
                    name: 'custrecord_ntx_so_finance_end_user',
                    operator: 'ANYOF',
                    values: customerId
                });
            filters.push(filterOne);
            if (sofId) {
                let filterTwo =
                    search.createFilter({
                        name: "internalidnumber",
                        operator: 'equalto',
                        values: [sofId]
                    });
                filters.push(filterTwo);
            }

            let searchResult = mySearch.run().getRange(0, 1);

            log.debug('res', JSON.stringify(searchResult));
            if (searchResult && searchResult.length > 0) {
                let currentResult = searchResult[0];
                return currentResult.getValue(currentResult.columns[0]) || 0;
            }


        }
        const updateDOName = (doId, customerId, newRec) => {

            var projectFieldLookup = search.lookupFields({
                type: record.Type.JOB,
                id: doId,
                columns: ['entityid']
            });
            //   let customerId = newRec.getValue('custrecord_ntx_do_customer');
            var customerFieldLookup = search.lookupFields({
                type: record.Type.CUSTOMER,
                id: customerId,
                columns: ['companyname']
            });

            var _doExistingName = newRec.getValue('custrecord_ntx_do_name');
            var _doJobId = projectFieldLookup.entityid;
            var _endCustomerName = customerFieldLookup.companyname;

            var _newDOName = _doJobId + ' -' + _endCustomerName + ' ' + _doExistingName;

            _newDOName = _newDOName.substring(0, 81);

            var updatedDOId = record.submitFields({
                type: record.Type.JOB,
                id: doId,
                values: {
                    companyname: _newDOName //,
                    //altname: _newDOName,
                    //  entityid: _newDOName
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });
            var deliveryObjRecord = record.load({
                type: record.Type.JOB,
                id: doId
            });
            //  deliveryObjRecord.setValue('companyname',_newDOName);
            deliveryObjRecord.save();

        }
        const updatePickerRecord = (obj, newRec) => {

            record.submitFields({
                type: newRec.type,
                id: newRec.id,
                values:obj
            });
        }
        const runSearch = (customerId, sofId, so_line_id) => {
            let scriptObj = runtime.getCurrentScript();
            let searchId = scriptObj.getParameter({
                name: 'custscript_ntx_get_customer_flex_credits'
            });

            let mySearch = search.load({
                id: searchId
            });
            let filters = mySearch.filters;

            let filterOne =
                search.createFilter({
                    name: 'custrecord_ntx_so_finance_end_user',
                    join: "custrecord_ntx_so_fin_dts_header",
                    operator: 'ANYOF',
                    values: customerId
                });
            filters.push(filterOne);
            if (sofId) {
                let filterOne =
                    search.createFilter({
                        name: 'internalidnumber',
                        join: "custrecord_ntx_so_fin_dts_header",
                        operator: 'equalto',
                        values: sofId
                    });
                filters.push(filterOne);
            }
            if (so_line_id) {
                let filterTwo =
                    search.createFilter({
                        name: 'custrecord_ntx_so_fin_dts_so_line_id',
                        operator: 'is',
                        values: so_line_id
                    });
                filters.push(filterTwo);
            }

            let searchResult = mySearch.run();


            return searchResult;


        }

        const drawDownrunSearch = (milestone_rec_id) => {
            let scriptObj = runtime.getCurrentScript();
            let searchId = scriptObj.getParameter({
                name: 'custscript_ntx_get_customer_flex_credits'
            });

            let mySearch = search.load({
                id: searchId
            });
            let drawDownFilters = []; //mySearch.filters;

            let filterTwo =
                search.createFilter({
                    name: 'custrecord_ntx_so_flex_alloc_fin_rel_ms',
                    join: "custrecord_ntx_so_flex_alloc_fin_detail",
                    operator: 'ANYOF',
                    values: milestone_rec_id
                });

            drawDownFilters.push(filterTwo);

            mySearch.filters = drawDownFilters;

            var searchResultCount = mySearch.runPaged().count;
            log.debug('SOF_SearchResultCount: ', searchResultCount);

            let searchResult = mySearch.run();

            return searchResult;


        }


        const calculate_toUse_Flex_Amt = (searchResult, revenueAmt, _actionType, flexunits) => {
            //log.debug('res', JSON.stringify(searchResult));
            let neededAmt = revenueAmt;
            let neededFlex = flexunits;
            let goingToUseAmt = 0;
            let goingToUseFlex = 0;
            let totalFromFlex = 0;
            let reachedLimit = false;
            let totalPurchased = 0;


            let obj_Id_Creds = {};
            let soId = '';
            let obj_sofDetailsId = {};

            searchResult.each((result) => {

                let obj_sof_values = {};
                let quantity = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_quantity",
                    summary: search.Summary.AVG
                }) || 0;
                let consumed = result.getValue({
                    name: 'formulanumeric',
                    summary: search.Summary.SUM,
                    formula: 'NVL({custrecord_ntx_so_flex_alloc_fin_detail.custrecord_ntx_so_flex_alloc_fin_qty}, 0)'
                }) || 0;

                if (_actionType == 'DRAW_DOWN')
                    consumed = 0;

                let notUseQuan = quantity; //- consumed; // "custrecord_ntx_so_fin_dts_quantity" Not Consumed for Parent Flex

                //log.debug('notUseQuan: ', notUseQuan);

                if (notUseQuan == 0) {
                    return true;
                }

                let totalAmount = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_amount",
                    summary: search.Summary.AVG
                });
                let unitPrice = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_flexunitprice",
                    summary: search.Summary.AVG
                });

                if (!unitPrice)
                    unitPrice = result.getValue({
                        name: "custrecord_ntx_so_finance_credits_price",
                        join: 'CUSTRECORD_NTX_SO_FIN_DTS_HEADER',
                        summary: search.Summary.AVG
                    });


                let internalId = result.getValue({
                    name: "internalid",
                    summary: search.Summary.GROUP
                }); //children record internalid
                let so_number = cleanupSoName(result.getValue({
                    name: "custrecord_ntx_so_finance_so",
                    join: 'CUSTRECORD_NTX_SO_FIN_DTS_HEADER',
                    summary: search.Summary.MIN
                }));


                let sku_id = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_item",
                    summary: search.Summary.GROUP
                });

                let _sof_detail_name = result.getValue({
                    name: "name",
                    join: "CUSTRECORD_NTX_SO_FIN_DTS_HEADER",
                    summary: search.Summary.GROUP
                }) || 0;
                let sof_header_id = result.getValue({
                    name: 'internalid',
                    join: 'CUSTRECORD_NTX_SO_FIN_DTS_HEADER',
                    summary: search.Summary.GROUP
                }); //header internal id
                log.debug('sof id', sof_header_id);


                let sf_order_line_id = result.getValue({
                    name: 'custrecord_ntx_so_fin_dts_sf_ord_line_id',
                    summary: search.Summary.GROUP
                });
                let linenum = result.getValue({
                    name: 'custrecord_ntx_so_fin_dts_so_line_id',
                    summary: search.Summary.GROUP
                });
                soId = result.getValue({
                    name: 'formulatext',
                    summary: search.Summary.MIN,
                    formula: '{custrecord_ntx_so_fin_dts_header.custrecord_ntx_so_finance_so.id}'
                });

                var filterOne = [];
                filterOne.push(search.createFilter({
                    name: 'internalId',

                    operator: 'ANYOF',
                    values: soId
                }));
                if (sf_order_line_id !== '- None -' && sf_order_line_id)
                    filterOne.push(search.createFilter({
                        name: 'custcol_sf_order_line_id',

                        operator: 'is',
                        values: sf_order_line_id
                    }));
                totalPurchased = getSearchResults('customsearch_ntx_so_finance_so_dts_flex', filterOne); //


                log.audit('so', soId + ',unitPrice: ' + unitPrice + ',neededAmt: ' + neededAmt + ',TotalPurchased: ' + totalPurchased);

                log.debug('internalId', internalId + ":notUseQuan:" + notUseQuan + ":goingToUseAmt:" + goingToUseAmt + ":unitPrice:" + unitPrice);


                /* if (parseFloat(unitPrice) > parseFloat(neededAmt) && parseFloat(goingToUseAmt) == 0) {
                     throw 'DO PROJECT:Not enough revenue amount to fetch credits.Increase revenue AMOUNT'
                 }*/
                if (parseFloat(neededFlex) < 1) {
                    throw 'DO PROJECT:Flex Credits should be greater than 0. Increase Flex Credits'
                }
                let totalAmt = parseFloat(notUseQuan) * parseFloat(unitPrice);
                let totalFlex = parseFloat(notUseQuan); //* parseFloat(unitPrice);
                log.debug('internalId', `${internalId}totalamt:${totalAmt}:needed amt${neededAmt}:notUseQuan:${notUseQuan}:unitPrice:${unitPrice}`);
                //  if (parseFloat(neededAmt) <= 0) {

                if (parseFloat(neededFlex) <= 0) {
                    log.debug('reached limit', goingToUseFlex + "::" + goingToUseAmt + '::' + neededAmt + "::" + revenueAmt);
                    reachedLimit = true;
                    return false;
                }
                //if (parseFloat(totalAmt) < parseFloat(neededAmt)) {
                if (parseFloat(totalFlex) < parseFloat(neededFlex)) {

                    let percentRevenue = getPercentRevenue(totalPurchased, notUseQuan);

                    log.debug('if', goingToUseAmt + ":" + goingToUseFlex + ":" + neededAmt);
                    goingToUseAmt += parseFloat(totalAmt);
                    goingToUseFlex += parseFloat(notUseQuan);
                    //obj_Id_Creds[internalId] = parseFloat(notUseQuan) - parseFloat(notUseQuan);
                    obj_sof_values['quantity_remaining'] = parseFloat(notUseQuan) - parseFloat(notUseQuan);
                    obj_sof_values['unitprice'] = unitPrice;
                    obj_sof_values['sof_detail_name'] = _sof_detail_name;
                    obj_sof_values['so_number'] = so_number;
                    obj_sof_values['sf_order_line_id'] = sf_order_line_id;
                    obj_sof_values['linenum'] = linenum;
                    obj_sof_values['sku_id'] = sku_id;
                    obj_sof_values['sof_header_id'] = sof_header_id;
                    obj_sof_values['total_quan'] = totalPurchased; //no 10:fix for %sku revenue
                  //  obj_sof_values['so_id'] = soId;
                    // obj_sof_values['sku_id'] =sku_id;
                    neededAmt = parseFloat(neededAmt) - parseFloat(totalAmt);
                    neededFlex = parseFloat(neededFlex) - parseFloat(totalFlex);
                    log.debug('if needed amt,obj_Id_Creds', neededAmt + "::" + JSON.stringify(obj_Id_Creds));

                    // obj_sofDetailsId[internalId] = notUseQuan;
                    obj_sof_values['percent_revenue'] = percentRevenue;
                    obj_sof_values['quantity_used'] = notUseQuan;


                    obj_sofDetailsId[internalId] = obj_sof_values;

                } else {
                    // -100 totalFlex) 25(neededFlex)) {
                    log.debug('else', goingToUseAmt + ":" + goingToUseFlex + ":" + neededAmt);
                    let approximateFlexToUse = 0;
                    approximateFlexToUse = parseFloat(neededFlex);
                    /*
                     * neededAmt 170;
                     * notUseQuan =50;up =85
                     * totalAmt =4250
                     * appr = 170 * 50/4250 ===2
                     * 50-2
                     * */
                    //1000 * ()
                    /*   approximateFlexToUse = (parseFloat(neededAmt) * parseFloat(notUseQuan)) / totalAmt;


                                                  if (numberIsDecimal(approximateFlexToUse)) {
                                                      var _approximateFlexToUse = Math.round(approximateFlexToUse); //rounded value- if this below .5 range, add 1,cuz user wants revenue amt > user's input
                                                      if (parseFloat(_approximateFlexToUse) < parseFloat(approximateFlexToUse)) {
                                                          _approximateFlexToUse = _approximateFlexToUse + 1
                                                      }
                                                      approximateFlexToUse = _approximateFlexToUse;


                                                  }
                                                  log.debug('appr flex', approximateFlexToUse);
                          */

                    if (parseFloat(approximateFlexToUse) <= 0 && parseFloat(goingToUseFlex) > 0) {
                        return false;
                    }
                    //   log.debug('approximate flex to use', approximateFlexToUse);
                    goingToUseFlex += parseFloat(approximateFlexToUse);
                    let _totalamt = parseFloat(approximateFlexToUse) * parseFloat(unitPrice);
                    goingToUseAmt += _totalamt;
                    let _totalFlex = parseFloat(approximateFlexToUse); //* parseFloat(unitPrice);


                    neededAmt = parseFloat(neededAmt) - parseFloat(_totalamt);
                    neededFlex = parseFloat(neededFlex) - parseFloat(_totalFlex);
                    log.debug('else condition ', 'else goingToUseFlex' + goingToUseFlex + ': else goingToUseAmt:' + goingToUseAmt + ':neededAmt:' + neededAmt);
                    log.debug('obj_Id_Creds', JSON.stringify(obj_Id_Creds));

                    obj_sof_values['quantity_remaining'] = parseFloat(notUseQuan) - parseFloat(approximateFlexToUse);

                    let percentRevenue = getPercentRevenue(totalPurchased, approximateFlexToUse);

                    obj_sof_values['percent_revenue'] = percentRevenue;
                    obj_sof_values['total_quan'] = totalPurchased;
                    obj_sof_values['quantity_used'] = approximateFlexToUse;
                    obj_sof_values['unitprice'] = unitPrice;
                    obj_sof_values['so_number'] = so_number;
                    obj_sof_values['sf_order_line_id'] = sf_order_line_id;
                    obj_sof_values['linenum'] = linenum;
                    obj_sof_values['sof_detail_name'] = _sof_detail_name;
                    obj_sof_values['sku_id'] = sku_id;
                    obj_sof_values['sof_header_id'] = sof_header_id;
                  //  obj_sof_values['so_id'] = soId;
                    obj_sofDetailsId[internalId] = obj_sof_values;

                    //  if (parseFloat(neededAmt) < parseFloat(unitPrice)) {
                    if (parseFloat(neededFlex) <= 0) {
                        //  if(neededAmt<=0){
                        return false;
                    }
                }
                return true;
            });
            log.debug('obj_Id_Creds', JSON.stringify(obj_Id_Creds));
            log.debug('final ', 'else goingToUseFlex' + goingToUseFlex + ': else goingToUseAmt:' + goingToUseAmt + ':neededAmt:' + neededAmt);
            log.debug('tst123', JSON.stringify(obj_sofDetailsId));
            return {
                "flex": goingToUseFlex,
                "msamount": goingToUseAmt,
                "recentSO": soId,
                'obj_sofDetailsId': obj_sofDetailsId
            };
            //return {"flex": goingToUseFlex, "msamount": goingToUseAmt, "recentSO": soId, 'obj_sofDetailsId':obj_sofDetailsId , 'obj_Id_Creds':obj_Id_Creds};
        }

        const getPercentRevenue = (totalFlexQuan, FlexToUse) => {
            // (value/total value)ï¿½100%.
            let percentUsed = ((parseFloat(FlexToUse) / parseFloat(totalFlexQuan)) * 100).toFixed(2);

            return percentUsed;
        }
        const createDOFlexAllocationRecord = (doId, flexMsId, newSofDetailId, parentSofDetails) => {

            let quan_used = parentSofDetails['quantity_used'];
            let percent_revenue = parseFloat(parentSofDetails['percent_revenue']);
            let total_quan = parentSofDetails['total_quan'];
            log.debug('obj_', JSON.stringify(parentSofDetails));
            if (!percent_revenue || isNaN(percent_revenue)) { //no 10:fix for %sku revenue
                percent_revenue = getPercentRevenue(total_quan, quan_used);
                log.debug('percent_revenue', percent_revenue);
            }
            log.debug('quan_used', quan_used)
            let doAllocation = record.create({
                type: 'customrecord_ntx_so_flex_allocation'
            });
            let _name = (Math.floor(Math.random() * 1000000000));
            log.debug('name', 'test' + _name);
            //  doAllocation.setValue({fieldId: 'name',_name});
            doAllocation.setValue({
                fieldId: 'custrecord_ntx_so_flex_alloc_fin_do_link',
                value: doId
            });
            log.audit('create do flex rec', quan_used);
            doAllocation.setValue({
                fieldId: 'custrecord_ntx_so_flex_alloc_fin_qty',
                value: quan_used
            });

            doAllocation.setValue({
                fieldId: 'custrecord_ntx_so_flex_alloc_fin_do_stat',
                value: '1'
            });
            doAllocation.setValue({
                fieldId: 'custrecord_ntx_so_flex_alloc_fin_rel_ms',
                value: flexMsId
            });
            doAllocation.setValue({
                fieldId: 'custrecord_ntx_so_flex_alloc_fin_detail',
                value: newSofDetailId
            });

            if (percent_revenue != "Infinity") {
                doAllocation.setValue({
                    fieldId: 'custrecord_ntx_so_flex_alloc_perc_skurev',
                    value: percent_revenue
                });
            }
            //custrecord_ntx_doalloc_credits_purchased
            let _allocationId = doAllocation.save();
            log.debug('_allocationId', _allocationId);


            //   }



        }
        const createNewSOFDetail = (obj_sofQuanDetails, doId, flexMsId, flexQuan, flexAmt) => {
            for (const _id in obj_sofQuanDetails) {
                let sofDetail = record.create({
                    type: 'customrecord_ntx_so_finance_details'
                });
                let quan_used = obj_sofQuanDetails[_id]['quantity_used'];

                let _name = (Math.floor(Math.random() * 1000000000));
                log.debug('name', 'test' + _name);

                sofDetail.setValue({
                    fieldId: 'custrecord_ntx_so_fin_dts_header',
                    value: obj_sofQuanDetails[_id]['sof_header_id']
                });
                sofDetail.setValue({
                    fieldId: 'custrecord_ntx_so_fin_dts_do',
                    value: doId
                });
                sofDetail.setValue({
                    fieldId: 'custrecord_ntx_so_fin_dts_sf_ord_line_id',
                    value: obj_sofQuanDetails[_id]['sf_order_line_id']
                });

                sofDetail.setValue({
                    fieldId: 'custrecord_ntx_so_fin_dts_parent_flex_ln',
                    value: _id
                });
                sofDetail.setValue({
                    fieldId: 'custrecord_ntx_so_fin_dts_so_line_id',
                    value: obj_sofQuanDetails[_id]['linenum']
                });
                sofDetail.setValue({
                    fieldId: 'custrecord_ntx_so_fin_dts_flexunitprice',
                    value: obj_sofQuanDetails[_id]['unitprice']
                });
                sofDetail.setValue({
                    fieldId: 'custrecord_ntx_so_fin_dts_item',
                    value: obj_sofQuanDetails[_id]['sku_id']
                });
                sofDetail.setValue({
                    fieldId: 'custrecord_ntx_so_fin_dts_quantity',
                    value: quan_used
                });
                //sofDetail.setValue({fieldId: 'custrecord_ntx_so_fin_dts_amount', value: flexAmt});
                sofDetail.setValue({
                    fieldId: 'custrecord_ntx_so_fin_dts_status',
                    value: 2
                });

                //sofDetail.setValue({fieldId: 'custrecord_ntx_so_fin_dts_sf_ord_line_id', value: _id});            //.    custrecord_ntx_so_fin_dts_sf_ord_line_id

                let sofDetailId = sofDetail.save();
                //create do alloc record
                createDOFlexAllocationRecord(doId, flexMsId, sofDetailId, obj_sofQuanDetails[_id]);


            }
        }
        //update so finance line with rem quan
        const updateSofLineRec = (obj_sofQuanDetails, doId, flexMsId, calculatedFlexCredits_ForMs, calculatedMsAmount_ForMs) => {
            log.debug('obj_sofQuanDetails', JSON.stringify(obj_sofQuanDetails));
            let arr_sof_headerID = [];
            for (const _id in obj_sofQuanDetails) {
                log.debug('_id', _id);
                let obj_values = {};

                let quan_remaining = obj_sofQuanDetails[_id]['quantity_remaining'];
                obj_values['custrecord_ntx_so_fin_dts_quantity'] = quan_remaining;

                if (quan_remaining == 0) {
                    obj_values['custrecord_ntx_so_fin_dts_status'] = '3';

                }
                record.submitFields({
                    id: _id,
                    type: 'customrecord_ntx_so_finance_details',
                    values: obj_values
                });
                arr_sof_headerID.push(obj_sofQuanDetails[_id]['sof_header_id']);


            }
            createNewSOFDetail(obj_sofQuanDetails, doId, flexMsId, calculatedFlexCredits_ForMs, calculatedMsAmount_ForMs)

            return arr_sof_headerID;

        }
        const replaceSOFDetailName = (_name, _num) => {
            log.debug('replacename', _name + "::" + _num)
            return _name.toString().replace(/\<(.+?)\>/g, "[" + _num + "]")
        }

        const create_DO_ForFlex = (msAmt, flexCount, newRec, recentSO) => {
            let existingDO = newRec.getValue('custrecord_ntx_do_existing_so');
            let msInternalId = '';
            if (!existingDO) {
                existingDO = createRelatedServicesProject(recentSO, newRec);
                log.debug('new project created for flex', existingDO);

            }

            return existingDO;
        }
        const create_MS_ForFlex = (msAmt, flexCount, newRec, existingDO, _flexReservation, soid) => {

            log.audit(msAmt + " " + flexCount + " " + newRec + " " + soid);
            let recObj = record.copy({
                type: record.Type.PROJECT_TASK,
                id: 1861254

            });
            recObj.setValue({
                fieldId: 'company',
                value: existingDO
            })
            if (newRec.getValue('custrecord_ntx_do_service_category'))
                recObj.setValue({
                    fieldId: 'custevent_service_category',
                    value: newRec.getValue('custrecord_ntx_do_service_category')
                })
            if (newRec.getValue('custrecord_ntx_do_proposed_usecase'))
                recObj.setValue({
                    fieldId: 'custevent_proposed_use_case',
                    value: newRec.getValue('custrecord_ntx_do_proposed_usecase')
                })
            if (newRec.getValue('custrecord_ntx_do_secondary_type'))
                recObj.setValue({
                    fieldId: 'custevent_secondary_type',
                    value: newRec.getValue('custrecord_ntx_do_secondary_type')
                })
            recObj.setValue({
                fieldId: 'custevent_ntx_flex_credit_allocated',
                value: flexCount
            })
            recObj.setValue({
                fieldId: 'custevent_milestone_amount',
                value: msAmt
            })
            recObj.setValue({
                fieldId: 'title',
                value: newRec.getValue('custrecord_ntx_do_ms_name')
            });
            if (soid) {
                recObj.setValue({
                    fieldId: 'custevent_ntx_do_related_so',
                    value: soid
                })
            }
            recObj.setValue({
                fieldId: 'startdate',
                value: new Date()
            });
            recObj.setValue({
                fieldId: 'custevent_ntx_is_milestone',
                value: true
            });
            recObj.setValue({
                fieldId: 'custevent_ntx_ms_serv_item',
                value: FLEX_ITEM
            })
            recObj = getRevDateForFlexMS(recObj);

            recObj.setValue('custevent_ntx_task_created_date', dateFormat(new Date()));

            // recObj.setValue({fieldId: 'custevent_ntx_ms_sof', value: true})
            //recObj.setValue({fieldId: 'custevent_ntx_ms_sof_sku', value: true})

            if (newRec.getValue('custrecord_ntx_do_service_category') == EDUCATION ||
                _flexReservation == true) {

                recObj.setValue('custevent_ms_status', CUSTOMER_NOT_READY);
                recObj.setValue('custevent_ms_status_qualifiers', UNDEFINED_FLEXCREDIT_USE);

            }

            return recObj.save();

        }
        const getRevDateForFlexMS = (recObj) => {
            var QUARTER = {
                "Q1": "1",
                "Q2": "2",
                "Q3": "3",
                "Q4": "4"
            };

            let rev_date = '';
            try {
                var date = new Date();


                var yy = date.getFullYear();
                var monthid = date.getMonth();
                monthid = parseInt(monthid) + 1;
                log.debug('montb', monthid)
                let mm = '';

                if (monthid == 8 || monthid == 9 || monthid == 10) {
                    mm = 10;
                    dd = 31;
                    quarterid = 'Q1';


                } else if (monthid == 11 || monthid == 12 || monthid == 1) {
                    mm = 1;
                    dd = 31;
                    //   yy = parseInt(yy) + 1;
                    quarterid = 'Q2';

                } else if (monthid == 2 || monthid == 3 || monthid == 4) {
                    mm = 4;
                    dd = 30;
                    quarterid = 'Q3';
                } else { //5,6,7
                    mm = 7;
                    dd = 31;
                    quarterid = 'Q4';
                }
                var quarterYear = yy;
                if (monthid >= 8 && monthid <= 12) {
                    quarterYear = parseInt(yy) + 1;
                }
                if (monthid == 11 || monthid == 12) {
                    yy = parseInt(yy) + 1;
                }

                log.debug('rev date', yy + ":" + mm + ":" + dd)
                //  rev_date = new Date(yy ,mm, dd);
                rev_date = (new Date(mm + '/' + dd + '/' + yy));
                recObj.setValue({
                    fieldId: 'custevent_ntx_revenue_date',
                    value: rev_date
                })
                recObj.setValue({
                    fieldId: 'custevent_milestone_quarter',
                    value: QUARTER[quarterid]
                })
                recObj.setValue({
                    fieldId: 'custevent_milestone_year',
                    value: getProjectYearId(quarterYear)

                })
                log.debug('test', JSON.stringify(recObj));
                log.debug('revdate', rev_date);
            } catch (e) {
                log.error('error getting rev date', e);
            } finally {
                return recObj;
            }
        }

        const getProjectYearId = (project_year) => {

            var projectYearId = null;

            var project_yearSearchObj = search.create({
                type: "customlist_project_year",
                filters: [
                    ["isinactive", "is", "F"],
                    "AND",
                    ["name", "is", project_year.toString()]
                ],
                columns: [
                    search.createColumn({
                        name: "name",
                        sort: search.Sort.ASC,
                        label: "Name"
                    }),
                    search.createColumn({
                        name: "internalid",
                        label: "Internal ID"
                    })
                ]
            });


            project_yearSearchObj.run().each(function(result) {
                projectYearId = result.getValue('internalid');
                return true;
            });

            return projectYearId;
        }
        let calculatedTotalEstHrs = 0;
        const createEffortHours = (flexMsId, flexPickerRec, fraction, ii) => {
            log.debug('createEffortHours', flexMsId + "::" + fraction);
            log.debug('flexPickerRec', JSON.stringify(flexPickerRec));
            if (!fraction || fraction == undefined)
                fraction = 1.0;

            let sublistName = 'recmachcustrecord_ef_flex_picker'; //recmachcustrecord_ef_project_task
            let numLines = flexPickerRec.getLineCount({
                sublistId: sublistName
            });
            if (numLines == -1) {
                sublistName = 'recmachcustrecord_ef_project_task';
                numLines = flexPickerRec.getLineCount({
                    sublistId: sublistName
                });
            }

            log.debug('numLines', numLines);

            for (let i = 0; i < numLines; i++) {
                let originalEstHrs = parseFloat(flexPickerRec.getSublistValue({
                    sublistId: sublistName,
                    fieldId: 'custrecord_ef_estimated_hours', //recmachcustrecord_ef_project_task
                    line: i
                }));
                let estHrs = (originalEstHrs || "0.0") * fraction;
                estHrs = estHrs.toFixed(2);
                calculatedTotalEstHrs = parseFloat(estHrs) + parseFloat(calculatedTotalEstHrs);
                let resType = flexPickerRec.getSublistValue({
                    sublistId: sublistName,
                    fieldId: 'custrecord_ef_resource_type',
                    line: i
                });
                let costRate = flexPickerRec.getSublistValue({
                    sublistId: sublistName,
                    fieldId: 'custrecord_ef_cost_rate',
                    line: i
                });
                log.debug('effrt hrs', costRate + ":" + estHrs + ":" + resType);
                log.debug('ii', numLines + "::" + i + '::' + originalEstHrs + '::' + calculatedTotalEstHrs);
                let x = numLines - 1;
                log.debug('variables', ii + "::" + i + "" + x);
                if (ii == 0 && (i == x)) { //for last milestone, check if calculated effort hrs is same as original one
                    //  if(1==2){
                    var del = parseFloat(originalEstHrs) - parseFloat(calculatedTotalEstHrs);

                    estHrs = parseFloat(estHrs) + parseFloat(del);
                    log.debug('del', del);
                }
                createEstimateHours(resType, flexMsId, costRate, estHrs);
            }
            estCalcLib.CalEstEftProject(flexMsId, 'userevent', true);
        }

        const createEstimateHours = (resType, flexMsId, costRate, estHrs) => {

            let customRecord = record.create({
                type: 'customrecord_estimated_efforts'
            });
            customRecord.setValue({
                fieldId: 'custrecord_ef_resource_type',
                value: parseInt(resType)
            });
            customRecord.setValue({
                fieldId: 'custrecord_ef_project_task',
                value: parseInt(flexMsId)
            });
            customRecord.setValue({
                fieldId: 'custrecord_ef_cost_rate',
                value: parseFloat(costRate)
            });
            customRecord.setValue({
                fieldId: 'custrecord_ef_estimated_hours',
                value: parseFloat(estHrs)
            });
            customRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: false
            });
        }

        function createRelatedServicesProject(soId, newRec) {
            var projectcompanyname = newRec.getValue('custrecord_ntx_do_name').substring(0, 81);


            var _sorec = record.load({
                type: record.Type.SALES_ORDER,
                id: soId
            });

            var templateid = runtime.getCurrentScript().getParameter('custscript_ntx_default_project_template');


            var newprojectrecord = record.create({
                type: 'job',
                isDynamic: true
            });

            var sosubsidiary = _sorec.getValue('subsidiary');
            var salesrep = _sorec.getValue('custbody14');
            var soregion = _sorec.getValue('custbody_region'); //so region
            var soenduser = _sorec.getValue('custbody21'); //so end user

            var entity = _sorec.getValue('entity');
            var crecord = search.lookupFields({
                type: record.Type.CUSTOMER,
                id: soenduser,
                columns: ['isperson']
            });
            var iscompany = crecord.isperson;

            //log.debug('Iscompany: '+iscompany);

            if (iscompany == false || iscompany == 'F')
                iscompany = false;

            if (iscompany == true || iscompany == 'T')
                iscompany = true;


            var tranid = _sorec.getValue('tranid'); //this will be the name of project


            var projectTemplateRec = record.load({
                type: 'projecttemplate',
                id: templateid,
                isDynamic: true,
            });


            var applyprojectexpensetypetoall = projectTemplateRec.getValue('applyprojectexpensetypetoall');
            var projectexpensetype = projectTemplateRec.getValue('projectexpensetype');
            var estimatedcostjc = projectTemplateRec.getValue('estimatedcostjc');
            var estimatedrevenuejc = projectTemplateRec.getValue('estimatedrevenuejc');
            var estimatedgrossprofit = projectTemplateRec.getValue('estimatedgrossprofit');
            var estimatedgrossprofitpercent = projectTemplateRec.getValue('estimatedgrossprofitpercent');
            var allowtime = projectTemplateRec.getValue('allowtime');
            var allowallresourcesfortasks = projectTemplateRec.getValue('allowallresourcesfortasks');
            var limittimetoassignees = projectTemplateRec.getValue('limittimetoassignees');
            var isutilizedtime = projectTemplateRec.getValue('isutilizedtime');
            var isproductivetime = projectTemplateRec.getValue('isproductivetime');
            var isexempttime = projectTemplateRec.getValue('isexempttime');
            var allowexpenses = projectTemplateRec.getValue('allowexpenses');
            var materializetime = projectTemplateRec.getValue('materializetime');
            var includecrmtasksintotals = projectTemplateRec.getValue('includecrmtasksintotals');
            var allowtasktimeforrsrcalloc = projectTemplateRec.getValue('allowtasktimeforrsrcalloc');
            var useallocatedtimeforforecast = projectTemplateRec.getValue('useallocatedtimeforforecast');

            newprojectrecord.setValue('custentity_ntx_related_so', soId);
            let project_Minus_Te_Amount = 0;
            if (project_Minus_Te_Amount)
                newprojectrecord.setValue('jobprice', parseFloat(project_Minus_Te_Amount));

            newprojectrecord.setValue('custentity_ntx_srp_so_num', tranid);
            newprojectrecord.setValue('companyname', projectcompanyname);
            newprojectrecord.setValue('subsidiary', sosubsidiary);
            newprojectrecord.setValue('entitystatus', 20);
            newprojectrecord.setValue('custentity_project_region', soregion);
            newprojectrecord.setValue('custentity_project_end_user', soenduser);
            newprojectrecord.setValue('custentity_ntx_srp_template_used', templateid);
            newprojectrecord.setValue('custentity_ntx_srp_sales_rep', salesrep);
            newprojectrecord.setValue('parent', entity);

            newprojectrecord.setValue('projectexpensetype', projectexpensetype);

            newprojectrecord.setValue('jobbillingtype', 'FBM');

            newprojectrecord.setValue('applyprojectexpensetypetoall', applyprojectexpensetypetoall);

            newprojectrecord.setValue('estimatedcostjc', estimatedcostjc);
            newprojectrecord.setValue('estimatedrevenuejc', estimatedrevenuejc);
            newprojectrecord.setValue('estimatedgrossprofit', estimatedgrossprofit);
            newprojectrecord.setValue('estimatedgrossprofitpercent', estimatedgrossprofitpercent);
            newprojectrecord.setValue('allowtime', allowtime);
            newprojectrecord.setValue('allowallresourcesfortasks', allowallresourcesfortasks);
            newprojectrecord.setValue('limittimetoassignees', limittimetoassignees);
            newprojectrecord.setValue('isutilizedtime', isutilizedtime);
            newprojectrecord.setValue('isproductivetime', isproductivetime);
            newprojectrecord.setValue('isexempttime', isexempttime);
            newprojectrecord.setValue('allowexpenses', allowexpenses);
            newprojectrecord.setValue('materializetime', materializetime);
            newprojectrecord.setValue('includecrmtasksintotals', includecrmtasksintotals);
            newprojectrecord.setValue('allowtasktimeforrsrcalloc', allowtasktimeforrsrcalloc);
            newprojectrecord.setValue('useallocatedtimeforforecast', useallocatedtimeforforecast);
            newprojectrecord.setValue('externalid', soId + '' + projectcompanyname);

            newprojectrecord.setValue('currency', _sorec.getValue('currency'));
            newprojectrecord.setValue('exchangerate', _sorec.getValue('exchangerate'));
            /*   var new_age_date = format.format({
                   value: new Date(),
                   type: format.Type.DATE
               });
               log.debug('start date', new_age_date);*/
            newprojectrecord.setValue('custentity_ntx_proj_create_date', new Date());
            newprojectrecord.setValue('custentity_ntx_edu_services_project_sync', false);


            var nprojectid = newprojectrecord.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            if (nprojectid)
                log.debug('Services Project Created Sucessfully: ', nprojectid);

            return nprojectid;
        }
        const updateDoAllocationStatus = (flexMsId, newMsStatus, milestone_exec_context) => {

            log.debug('updateDoAllocationStatus', flexMsId + " " + newMsStatus + " " + milestone_exec_context)

            let arr_sof_header = [];
            log.debug('msstatus', newMsStatus);

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
                if (milestone_exec_context == 'delete') {
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

                    //Delete related Resource Allocation record : Added by Deepan on Sep 24,2021

                    getResourceAllocation(flexMsId);

                } else {
                    let doAllocStatus = 1;
                    if (['7', '8'].indexOf(newMsStatus) > -1) {
                        doAllocStatus = 2;
                    }
                    record.submitFields({
                        type: 'customrecord_ntx_so_flex_allocation',
                        id: doAllocId,
                        values: {
                            'custrecord_ntx_so_flex_alloc_fin_do_stat': doAllocStatus
                        }
                    });
                }
                log.debug('sofHeaderId', sofHeaderId);
                arr_sof_header.push(sofHeaderId);

                return true;
            });

            return arr_sof_header;

        }
        const getAllocatedConsumedforSOF = (sofHeaderId) => {
            log.debug('getAllocatedConsumedforSOF', sofHeaderId);
            if (!sofHeaderId) return;
            let obj_val = {};
            const search_allocated_consumed = 'customsearch_upd_sof_header';
            let mySearch = search.load({
                id: search_allocated_consumed
            });
            let filters = mySearch.filters;
            let filterOne =
                search.createFilter({
                    name: 'internalId',
                    join: "custrecord_ntx_so_fin_dts_header",
                    operator: 'ANYOF',
                    values: sofHeaderId
                });
            filters.push(filterOne);
            let allocatedCred = 0;
            let consumedCred = 0;
            let newbalance = 0;
            let totalCredits = 0;
            mySearch.run().each(function(result) {
                let cols = result.columns;
                totalCredits = result.getValue(cols[2]) || 0;
                let status = result.getValue(cols[0]) || 0;
                let quan = result.getValue(cols[1]) || 0;

                if (status == 1) obj_val['custrecord_ntx_so_finance_credits_alloc'] = allocatedCred = quan;
                if (status == 2) obj_val['custrecord_ntx_so_finance_credits_consum'] = consumedCred = quan;

                //  obj_flex_Status_Credits[status] = quan;
                return true;
            });
            log.audit('newbalance', totalCredits + "::" + newbalance);
            newbalance = pnvl(totalCredits, true) - pnvl(consumedCred, true) - pnvl(allocatedCred, true);
            obj_val['custrecord_ntx_so_finance_credits_balanc'] = newbalance;
            obj_val['custrecord_ntx_so_finance_credits_consum'] = consumedCred;
            obj_val['custrecord_ntx_so_finance_credits_alloc'] = allocatedCred;
            log.debug('all cred details',
                '::totalCredits::' + totalCredits + "::allocatedCred::" + allocatedCred + '::newbalance::' + newbalance + '::consumedCred::' + consumedCred)
            return obj_val;
        }
        const pnvl = (value, number) => {
            if (number) {
                if (isNaN(parseFloat(value))) return 0;
                return parseFloat(value);
            }
            if (value == null) return '';
            return value;
        }
        const updateSofDetail_FlexParent_NewBalance = (arr_sofHeaderId) => {
            log.audit('arr_sofHeaderId', arr_sofHeaderId.toString());
            const sofFlexDetailParent = 'customsearch_get_parent_flex_sofdetail'; //14830;
            let mySearch = search.load({
                id: sofFlexDetailParent
            });
            let filters = mySearch.filters;
            let filterOne =
                search.createFilter({
                    name: 'internalId',
                    join: "custrecord_ntx_so_fin_dts_header",
                    operator: 'ANYOF',
                    values: arr_sofHeaderId
                });
            filters.push(filterOne);
            mySearch.run().each(function(result) {
                let sofDetail_flexParent = result.id;
                /*  let newBalance = result.getValue({
                      name: 'custrecord_ntx_so_finance_credits_balanc',
                      join: "custrecord_ntx_so_fin_dts_header"
                  });*/
                let soID = result.getValue({
                    name: 'custrecord_ntx_so_finance_so',
                    join: "custrecord_ntx_so_fin_dts_header"
                });
                let sofHeaderId = result.getValue({
                    name: 'internalId',
                    join: "custrecord_ntx_so_fin_dts_header"
                });

                let sfdcLineId = result.getValue({
                    name: 'custrecord_ntx_so_fin_dts_sf_ord_line_id'
                });
                log.audit('bal', "sofDetail_flexParent:::" + sofDetail_flexParent);
                var __bal = getBalance(soID, sofHeaderId, sfdcLineId, sofDetail_flexParent);
                let _status = parseFloat(__bal) > 0 ? 1 : 3;
                record.submitFields({
                    type: 'customrecord_ntx_so_finance_details',
                    id: sofDetail_flexParent,
                    values: {
                        'custrecord_ntx_so_fin_dts_quantity': __bal,
                        'custrecord_ntx_so_fin_dts_status': _status
                    }
                })
                return true;
            });
        }

        // calculate the balance, based on the toal, consumed, and allocated.
        const getBalance = (soID, sofHeaderId, sfdcLineId, sofDetailRecId) => {
            log.debug('getBalance', `soId ${soID} :: sofHeaderId ${sofHeaderId}`);
            const search_totalPurchased = 'customsearch_ntx_so_finance_so_dts_flex';
            const search_allocated = 'customsearch_ntx_so_flex_allocated';
            const search_consumed = 'customsearch_ntx_so_flex_consumed'
            // get the flex quantity from the SO, using sfdc line id
            let totalPurchasedFilter = [search.createFilter({
                name: 'internalId',
                operator: 'ANYOF',
                values: soID
            }), search.createFilter({
                name: 'custcol_sf_order_line_id',
                operator: 'is',
                values: sfdcLineId
            })];
            let totalPurchased = getSearchResults(search_totalPurchased, totalPurchasedFilter);
            // get the consumed/allocated filtering by parent id
            let totalAllocatedFilter = [search.createFilter({
                name: 'internalId',
                join: "custrecord_ntx_so_fin_dts_header",
                operator: 'ANYOF',
                values: sofHeaderId
            }), search.createFilter({
                name: 'custrecord_ntx_so_fin_dts_parent_flex_ln',
                operator: 'is',
                values: sofDetailRecId
            })];
            let allocated = getSearchResults(search_allocated, totalAllocatedFilter)

            let totalConsumedFilter = [search.createFilter({
                name: 'internalId',
                join: "custrecord_ntx_so_fin_dts_header",
                operator: 'ANYOF',
                values: sofHeaderId
            }), search.createFilter({
                name: 'custrecord_ntx_so_fin_dts_parent_flex_ln',
                operator: 'is',
                values: sofDetailRecId
            })];
            let consumed = getSearchResults(search_consumed, totalConsumedFilter);

            let balance = parseInt(totalPurchased) - parseInt(allocated) - parseInt(consumed);
            return balance;
        }

        const getSearchResults = (searchId, searchFilter) => {
            var resulVal = '';
            var mySearch = search.load({
                id: searchId
            });
            var filters = mySearch.filters;
            var filterOne =
                searchFilter
            mySearch.filters = filters.concat(filterOne);

            mySearch.run().each(function(result) {
                var cols = result.columns;
                resulVal = result.getValue(cols[0]) || 0;

            });
            return resulVal;

        }
        const updateSofHeader = (arr_sofHeaderId, milestone_exec_context) => {
            try {
                if (arr_sofHeaderId)
                    arr_sofHeaderId = arr_sofHeaderId.toString().split(',');
                log.debug('arr_sofheader', arr_sofHeaderId.toString());
                arr_sofHeaderId.forEach(function(sofHeaderId) {
                    log.debug('sofheader', sofHeaderId);
                    if (milestone_exec_context == 'delete') {
                        record.delete({
                            type: 'customrecord_ntx_so_finance',
                            id: sofHeaderId
                        })
                    } else {
                        let obj_val = getAllocatedConsumedforSOF(sofHeaderId);

                        record.submitFields({
                            type: 'customrecord_ntx_so_finance',
                            id: sofHeaderId,
                            values: obj_val
                        });
                    }
                });

            } catch (e) {
                log.error('err updateSofHeader', e);
            }

        }

        function dateFormat(date) {

            var formatedDateValue = null;

            if (date != null && date != "") {
                formatedDateValue = new Date(date);

                var dd = formatedDateValue.getDate();
                var mm = formatedDateValue.getMonth() + 1;
                var yyyy = formatedDateValue.getFullYear();

                var formatedDateValue = new Date(mm + '/' + dd + '/' + yyyy);
            }

            return formatedDateValue;
        }
        const updateFlexMs = (sofHeaderId, flexMsId) => {

            log.debug('sofHeaderId', sofHeaderId);
            try {
                let sofCustomerLogisticInfo = record.load({
                    type: 'customrecord_ntx_so_finance',
                    id: sofHeaderId
                });
                let _newMSRecord = record.load({
                    type: 'projecttask',
                    id: flexMsId
                });

                const obj_map = {
                    "custrecord_ntx_so_finance_customer": "custevent_ntx_so_finance_customer",
                    "custrecord_ntx_so_finance_end_user": "custevent_ntx_ms_end_user",
                    "custrecord_ntx_so_finance_cus_email": "custevent_ntx_ms_cus_email",
                    "custrecord_ntx_so_finance_cus_first_name": "custevent_ntx_ms_cus_first_name",
                    "custrecord_ntx_so_finance_cus_last_name": "custevent_ntx_ms_cus_last_name",
                    "custrecord_ntx_so_finance_cus_address": "custevent_ntx_ms_cus_address",
                    "custrecord_ntx_so_finance_cus_phone_num": "custevent_ntx_ms_cus_phone_num",
                    "custrecord_ntx_so_finance_hypervisor": "custevent_ntx_ms_hypervisor",
                    "custrecord_ntx_so_finance_install_street": "custevent_ntx_ms_install_street",
                    "custrecord_ntx_so_finance_install_city": "custevent_ntx_ms_install_city",
                    "custrecord_ntx_so_finance_install_state": "custeventntx_ms_install_state",
                    "custrecord_ntx_so_finance_ins_postalcode": "custevent_ntx_ms__ins_postalcode",
                    "custrecord_ntx_so_finance_install_cntry": "custevent_ntx_ms_install_cntry",
                    "custrecord_ntx_so_finance_reseller_name": "custevent_ntx_ms_reseller_name",
                    "custrecord_ntx_so_finance_reseller_addr": "custevent_ntx_ms_reseller_addr",
                    "custrecord_ntx_so_finance_disti_name": "custevent_ntx_ms_disti_name",
                    "custrecord_ntx_so_finance_disti_address": "custevent_ntx_ms_disti_address",
                    "custrecord_ntx_so_finance_est_ship_date": "custevent_ntx_ms_est_ship_date",
                    "custrecord_ntx_so_finance_actual_shpdate": "custevent_ntx_ms_actual_shpdate",
                    "custrecord_ntx_sof_strategic_deal": "custevent_ntx_key_engagement_ms",
                    "custrecord_ntx_so_finance_theater": "custevent_ntx_ms_theater",
                    "custrecord_ntx_so_finance_region": "custevent_ntx_ms_region",
                    "custrecord_ntx_so_finance_subregion": "custevent_ntx_ms_subregion",
                    "custrecord_ntx_so_finance_hypervisor": "custevent_ntx_ms_hypervisor",
                    "custrecord_ntx_zero_approval_group": "custevent_ntx_zero_approval_group"
                }

                for (const key in obj_map) {

                    if(key.toString() != "custrecord_ntx_sof_strategic_deal"){
                        _newMSRecord.setValue(obj_map[key],
                            sofCustomerLogisticInfo.getValue({
                                fieldId: [key].toString()
                            })
                        );
                    }

                    if(key.toString() == "custrecord_ntx_sof_strategic_deal"){ //BA-89032

                        var _strategicDeal =  sofCustomerLogisticInfo.getValue({
                            fieldId: [key].toString()
                        });

                        if(_strategicDeal == 'T')
                            _strategicDeal = true;

                        if(_strategicDeal == 'F')
                            _strategicDeal = false;

                        _newMSRecord.setValue(obj_map[key],_strategicDeal);

                    }

                }


                _newMSRecord.save();
            } catch (e) {
                log.error('errr updating flex ms', e);
            }

        }
        function getResourceAllocation(milestone_rec_id) {
            var resourceallocationSearchObj = search.create({
                type: "resourceallocation",
                filters: [
                    ["projecttask", "anyof", milestone_rec_id]
                ],
                columns: [
                    search.createColumn({
                        name: "internalid",
                        sort: search.Sort.ASC,
                        label: "Internal ID"
                    })
                ]
            });

            var searchResultCount = resourceallocationSearchObj.runPaged().count;
            log.debug("resourceCount", searchResultCount);

            resourceallocationSearchObj.run().each(function(result) {
                try {

                    var resourceAllocationId = result.getValue("internalid");

                    if (resourceAllocationId)
                        record.delete({
                            type: 'resourceallocation',
                            id: resourceAllocationId
                        });

                } catch (ex) {
                    log.error('Error while deleting Resource Allocation: ', ex.message);
                }
                return true;
            });
        }

        return {
            create_DO_ForFlex: create_DO_ForFlex,
            createEffortHours: createEffortHours,
            create_MS_ForFlex: create_MS_ForFlex,
            updateSofLineRec: updateSofLineRec,
            createDOFlexAllocationRecord: createDOFlexAllocationRecord,
            updatePickerRecord: updatePickerRecord,
            runSearch: runSearch,
            drawDownrunSearch: drawDownrunSearch,
            getResourceAllocation: getResourceAllocation,
            createNewSOFDetail: createNewSOFDetail,
            calculate_toUse_Flex_Amt: calculate_toUse_Flex_Amt,
            getTotalExistingAmtForCustomer: getTotalExistingAmtForCustomer,
            updateDoAllocationStatus: updateDoAllocationStatus,
            updateSofHeader: updateSofHeader,
            getAllocatedConsumedforSOF: getAllocatedConsumedforSOF,
            updateSofDetail_FlexParent_NewBalance: updateSofDetail_FlexParent_NewBalance,
            getPercentRevenue: getPercentRevenue,
            updateDOName:updateDOName,
            updateFlexMs:updateFlexMs
        };

    });