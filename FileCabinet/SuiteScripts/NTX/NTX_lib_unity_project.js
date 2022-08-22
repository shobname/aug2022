/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
/*
* 1.0       shobiya             march 2022      BA-88628 Project Unity: Credits consumption
*2.0		shobiya		july 4 2022. BA-91199
* */
define(['N/record', 'N/runtime', 'N/search', '/SuiteScripts/NTX/NTX_Library_Delivery_Order'],

    function(record, runtime, search, libDO) {
        const MAIN_SERVICE_TYPE = {

            EXPIRED: 3
        }
        const CHILD_SERV_TYPE={
            EDU_LOB:1,
            CNS_LOB:2
        }
        const PERCENTAGES = {
            EDU_BETTER: 34,
            EDU_BEST: 30,
            CNS_BETTER: 66, CNS_BEST: 70

        }
        const ACTUAL_PERCENTAGES = {
            SERVICES_BETTER: 0.167, SERVICES_BEST: 0.229,
            EDU_BETTER: 0.232,EDU_BEST: 0.141,
            CNS_BETTER: 0.464, CNS_BEST: 0.337

        }
        function getRelatedSOF(soid){

            try{
                var so_financeSearchObj = search.create({
                    type: "customrecord_ntx_so_finance",
                    filters: [
                        ["isinactive","is","F"],
                        "AND",
                        ["custrecord_ntx_so_finance_so","anyof",soid]
                    ]
                });



                var sofResults = so_financeSearchObj.run().getRange({
                    start: 0,
                    end: 1
                });

                if(sofResults && sofResults.length >0)
                    return sofResults[0].id;
            }
            catch(e){
                //  throw e;
                log.error('err while finding relatesd sof',soid);
            }

        }
        const mergeObjects=(obj_unity_usage,obj_so,main_serv_type)=>{
            let unity_sf_req_ids = Object.keys(obj_unity_usage);
            let so_sf_req_ids = Object.keys(obj_so);
            // throw JSON.stringify(obj_so)
            for (let a = 0; a < unity_sf_req_ids.length; a++) {
                let __unity_sf_req_id = unity_sf_req_ids[a];

                // let so_id = obj_unity_usage[unity_sf_req_ids[a]]["netsuite_so_id"];
                for (let b = 0; b < so_sf_req_ids.length; b++) {
                    let __so_sf_req_id = so_sf_req_ids[b];
                    //  throw __so_sf_req_id;
                    if(__unity_sf_req_id ==__so_sf_req_id){
                        let support_level=obj_so[so_sf_req_ids[b]]["support_level"];
                        let so_amt= obj_so[so_sf_req_ids[b]]["so_amount"];
                        obj_unity_usage[__unity_sf_req_id]['unity_term'] =obj_so[so_sf_req_ids[b]]["unity_term"];
                        obj_unity_usage[__unity_sf_req_id]['unity_credits'] =obj_so[so_sf_req_ids[b]]["unity_credits"];
                        obj_unity_usage[__unity_sf_req_id]['so_amount'] =so_amt;
                        obj_unity_usage[__unity_sf_req_id]['so_item'] =obj_so[so_sf_req_ids[b]]["so_item"];
                        obj_unity_usage[__unity_sf_req_id]['support_level'] =support_level;
                        obj_unity_usage[__unity_sf_req_id]['sf_order_line_id'] =obj_so[so_sf_req_ids[b]]["sf_order_line_id"];
                        obj_unity_usage[__unity_sf_req_id]['sf_req_line'] =obj_so[so_sf_req_ids[b]]["sf_req_line"];
                        obj_unity_usage[__unity_sf_req_id]['linenum'] =obj_so[so_sf_req_ids[b]]["linenum"];
                        /*
                        calculate ms amt here,% here
                        * */

                        let _credits_consumed = parseInt(obj_unity_usage[__unity_sf_req_id]["_credits_consumed"]);
                        let __terms=obj_unity_usage[__unity_sf_req_id]["unity_term"];

                        let _credits_purchased = parseInt(obj_unity_usage[__unity_sf_req_id]["_credits_purchased"]) * (parseInt(__terms) / 12);

                        let services_percent = support_level =='ADVANCED'? ACTUAL_PERCENTAGES.SERVICES_BETTER:ACTUAL_PERCENTAGES.SERVICES_BEST;
                        if(main_serv_type ==MAIN_SERVICE_TYPE.EXPIRED){
                            //calc ms amt for edu & cns
                            /////

                            let services_amt =(parseFloat(services_percent)*parseFloat(so_amt))/100;
                            let __cns = support_level ==='ADVANCED'? PERCENTAGES.CNS_BETTER:PERCENTAGES.CNS_BEST;

                            let _cns_ms_amt =(parseFloat(__cns) * parseFloat(services_amt)).toFixed(2);
                            let __edu = support_level =='ADVANCED'? PERCENTAGES.EDU_BETTER:PERCENTAGES.EDU_BEST;

                            let _edu_ms_amt = (parseFloat(__edu) * parseInt(services_amt)).toFixed(2);

                            let __cns_ms_expired_credits =__cns*parseInt(_credits_consumed)/100;

                            let __edu_ms_expired_credits = __edu*parseInt(_credits_consumed)/100;
                            obj_unity_usage[__unity_sf_req_id]['expiry_cns_credits_consumed']=__cns_ms_expired_credits;
                            obj_unity_usage[__unity_sf_req_id]['expiry_edu_credits_consumed']=__edu_ms_expired_credits;
                            obj_unity_usage[__unity_sf_req_id]['expiry_cns_ms_amt']=_cns_ms_amt;
                            obj_unity_usage[__unity_sf_req_id]['expiry_edu_ms_amt']=_edu_ms_amt;
                            //      throw _cns_ms_amt +"::"+so_amt;
                            obj_unity_usage[__unity_sf_req_id]['expiry_cns_do_alloc_percent']=((parseFloat(_cns_ms_amt)/parseFloat(so_amt))*100).toFixed(2);
                            obj_unity_usage[__unity_sf_req_id]['expiry_edu_do_alloc_percent']=((parseFloat(_edu_ms_amt)/parseFloat(so_amt))*100).toFixed(2);

                        }
                        else {
                            var _service_type = obj_unity_usage[__unity_sf_req_id]["_service_type"];


                            if (_service_type == CHILD_SERV_TYPE.CNS_LOB) {
                                let cns_percent = support_level == 'ADVANCED' ? ACTUAL_PERCENTAGES.CNS_BETTER : ACTUAL_PERCENTAGES.CNS_BEST;
                                obj_unity_usage = update_obj_unity_usage(so_amt, services_percent, cns_percent, _credits_consumed, _credits_purchased, __unity_sf_req_id, obj_unity_usage);


                            }
                            if (_service_type == CHILD_SERV_TYPE.EDU_LOB) {
                                let edu_percent = support_level == 'ADVANCED' ? ACTUAL_PERCENTAGES.EDU_BETTER : ACTUAL_PERCENTAGES.EDU_BEST;

                                obj_unity_usage = update_obj_unity_usage(so_amt, services_percent, edu_percent, _credits_consumed, _credits_purchased, __unity_sf_req_id, obj_unity_usage);

                            }
                        }
                        break;
                    }

                }

            }
            // throw JSON.stringify(obj_unity_usage);
            return obj_unity_usage;
        }
        function update_obj_unity_usage(so_amt,services_percent,lob_percent,_credits_consumed,_credits_purchased,__unity_sf_req_id,obj_unity_usage){
            //this for both cns and edu
            let lob_ms_amt = (parseFloat(so_amt)* parseFloat(services_percent) *parseFloat(lob_percent) *(parseInt(_credits_consumed)/parseInt(_credits_purchased))).toFixed(2);
            let lob_percent_alloc = ((parseFloat(lob_ms_amt)/parseFloat(so_amt)) *100).toFixed(2);
            obj_unity_usage[__unity_sf_req_id]['do_alloc_percent'] =  lob_percent_alloc;//(parseInt(x[_service_type]['ms_amt']) || 0) +parseInt(cns_ms_amt);
            obj_unity_usage[__unity_sf_req_id]['ms_amt'] =  parseFloat(lob_ms_amt);
            return obj_unity_usage;
        }

        function createTask(proj_id,sum_of_credits_consumed,main_serviceType,so_item) {
            try {
                const FORFEIT = 10;
                const UNSCHEDULED = 1;

                var crm_task = record.create({type: 'task'});
                log.debug(proj_id);
                crm_task.setValue('custevent_ntx_project_id', proj_id);
                crm_task.setValue('title', "TASK - NCX Credits ");
                //     crm_task.setValue('custevent_ntx_edu_task_item', itemid);
                let line_status = main_serviceType == MAIN_SERVICE_TYPE.EXPIRED ? FORFEIT : UNSCHEDULED;
                crm_task.setValue('custevent_ntx_edu_task_status', line_status);
                let unity_credits = main_serviceType == MAIN_SERVICE_TYPE.EXPIRED ? FORFEIT : UNSCHEDULED;
                crm_task.setValue('custevent_ntx_unity_credits', sum_of_credits_consumed);
                crm_task.setValue('custevent_ntx_edu_task_item', so_item);
                //     crm_task.setValue('custevent_ntx_edu_task_clas_seat', '');
                //  crm_task.setValue('custevent_ntx_edu_task_unit_price', unitprice);
                //   crm_task.setValue('custevent_ntx_edu_task_schedule_date', ''); //empty for unschedule
                //   crm_task.setValue('custevent_ntx_edu_task_clas_seat', class_seat_type); //empty for unschedule

                crm_task.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
            }
            catch(e){
                // throw e;
                log.error('err:createTask',e);
            }



        }
        /*function serviceTypeCount(offeringId){
            try {
                let customrecord_unity_service_offerringSearchObj = search.create({
                    type: "customrecord_unity_service_offerring",
                    filters:
                        [
                            ["internalidnumber", "equalto", offeringId]
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "custrecord_ntx_ut_serv_type",
                                join: "CUSTRECORD_NTX_UT_SERV_OFFERING",
                                summary: "GROUP",
                                sort: search.Sort.ASC,
                                label: "Service Type (EDU/CNS)"
                            })
                        ]
                });
                var searchResultCount = customrecord_unity_service_offerringSearchObj.runPaged().count;
                return searchResultCount;
            }
            catch(e){
                log.error()
            }

        }*/

        function createEDUProject(main_serviceType,obj_unity_usage,__obj_so_details) {
            try{
                let obj_so_details;

                if (main_serviceType == MAIN_SERVICE_TYPE.EXPIRED) {
                    obj_so_details = __obj_so_details['expired'];
                }
                ///so_item
                else {

                    obj_so_details = __obj_so_details[CHILD_SERV_TYPE.EDU_LOB];
                }

                let sum_of_credits_consumed = obj_so_details._credits_consumed;

                let recent_so_id = obj_so_details.netsuite_so_id;
                let so_item = obj_so_details.so_item;

                let ms_expired_credits = obj_so_details['edu_credits_consumed'];//p*sum_of_credits_consumed/100;


                let sorec = record.load({
                    type: 'salesorder',
                    id: recent_so_id
                });


                var tranid = sorec.getValue('tranid');
                var trandate = sorec.getValue('trandate');
                var soendusertext = sorec.getText('custbody21');

                let projrec = record.create({
                    type: 'job'
                });

                projrec.setValue('customform', 127); // edu form
                projrec.setValue('subsidiary', sorec.getValue('subsidiary'));
                projrec.setValue('startdate', trandate);

                //start of 1.1
                var projectcompanyname = "EDU " + tranid + " " + soendusertext;
                if (projectcompanyname && (projectcompanyname.length >= 82)) {
                    projectcompanyname = projectcompanyname.substring(0, 81);
                }

                projrec.setValue('companyname', projectcompanyname);
                //end of 1.1
                var __cust = sorec.getValue('custbody21');

                projrec.setValue('custentity_project_end_user', __cust);

                projrec.setValue('custentity_ntx_srp_so_num', tranid);
                projrec.setValue('custentity_sfdc_so', sorec.getValue('custbody_sf_order_number'));
                projrec.setValue('custentity_ntx_edu_proj_so', recent_so_id);
                projrec.setValue('custentity_ntx_edu_reseller', sorec.getValue('custbody19'));
                projrec.setValue('custentity_ntx_edu_eu_region', sorec.getValue('custbody_region'));
                projrec.setValue('custentity_install_country', sorec.getValue('custentity_ntx_proj_eu_country'));
                projrec.setValue('custentity_install_city', sorec.getValue('custbody_end_user_city'));
                projrec.setValue('custentity_install_state', sorec.getValue('custbody_end_user_state'));
                projrec.setValue('custentity_ntx_srp_sales_rep', sorec.getValue('custbody14'));
                //3.0
                var sfdc_cust_id = '';
                if (__cust)
                    sfdc_cust_id = search.lookupFields({
                        type: 'customer',
                        id: __cust,
                        columns: ['custentity_sfdc_id_18_character']
                    }).custentity_sfdc_id_18_character;


                // sfdc_cust_id = record.search('customer', __cust, 'custentity_sfdc_id_18_character');
                projrec.setValue('custentity_ntx_edu_sfdc_order_id', sorec.getValue('custbody9'));
                projrec.setValue('custentity_ntx_edu_sfdc_cust_id', sfdc_cust_id);
                const UNSCHEDULED = 1;
                let main_status = main_serviceType == MAIN_SERVICE_TYPE.EXPIRED ? 5 : 1;
                projrec.setValue('custentity_ntx_edu_mainstatus', main_status); // unscheduled for new records

                //   projrec.setValue('custentity_ntx_total_rev_rec_price', '0');
                projrec.setValue('custentity_ntx_edu_proj_type', 'EDU');
                projrec.setValue('currency', sorec.getValue('currency'));
                projrec.setValue('exchangerate', sorec.getValue('exchangerate'));


                let proj_id = projrec.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                sum_of_credits_consumed = main_serviceType == MAIN_SERVICE_TYPE.EXPIRED ? ms_expired_credits : sum_of_credits_consumed;
                createTask(proj_id, sum_of_credits_consumed, main_serviceType, so_item);
                return proj_id;
                //    return proj_id;
            }catch(e){
                //  throw e;
                log.error('err while creating edu proj',e);
            }

        }

        function createSalesOrderObj(arr_sf_order_line) {
            try{
                let filter_arr = [];
                let obj_so = {};
                let new_filter_arr = [];
                let test = [["mainline", "is", "F"],
                    "AND",
                    ["type", "anyof", "SalesOrd"]];
                for (const sf_order_line of arr_sf_order_line) {
                    log.debug(sf_order_line);

                    filter_arr.push(["custcol_sf_order_line_id", "is", sf_order_line]);
                    filter_arr.push('OR');
                }

                filter_arr.pop();
                new_filter_arr.push(test);
                new_filter_arr.push('AND');
                new_filter_arr.push(filter_arr);
                var transactionSearchObj = search.create({
                    type: "transaction",
                    // title: 'My SalesOrder Searchd'+ Math.floor((Math.random() * 100) + 1),
                    //   id: 'customsearch_my_so_searc1h'+ Math.floor((Math.random() * 100) + 1),
                    filters: new_filter_arr,
                    columns:
                        [
                            search.createColumn({name: "custcol_sf_order_line_id"}),
                            search.createColumn({name: "custcol_unity_credit_term"}),
                            search.createColumn({name: "custcol_unity_credits"}),
                            search.createColumn({name: "amount"}),
                            search.createColumn({name: "custcol_support_level"}),
                            search.createColumn({name: "item"}),
                            search.createColumn({name: "custcol_sf_order_line_id"}),
                            search.createColumn({name: "custcol_sf_order_required_by_line"}),
                            search.createColumn({name: "line"})
                            //linenum

                        ]
                });

                transactionSearchObj.run().each(function (result) {


                    let sf_order_id = result.getValue('custcol_sf_order_line_id');
                    // .run().each has a limit of 4,000 results
                    obj_so[sf_order_id] = {};
                    let __terms =result.getValue('custcol_unity_credit_term') ||12;
                    obj_so[sf_order_id]["unity_term"] = __terms;//result.getValue('custcol_unity_credit_term');
                    obj_so[sf_order_id]["unity_credits"] = result.getValue('custcol_unity_credits');
                    obj_so[sf_order_id]["so_amount"] = result.getValue('amount');
                    obj_so[sf_order_id]["so_item"] = result.getValue('item');
                    obj_so[sf_order_id]["sf_order_line_id"] = result.getValue('custcol_sf_order_line_id');
                    obj_so[sf_order_id]["sf_req_line"] = result.getValue('custcol_sf_order_required_by_line');
                    obj_so[sf_order_id]["linenum"] = result.getValue('line');


                    obj_so[sf_order_id]["support_level"] = result.getValue('custcol_support_level').toString().toUpperCase();
                    return true;
                });
                return obj_so;
            }
            catch(e){
                //  throw e;
                log.error('err:createSalesOrderObj',e)
            }
        }
        const getServiceUsageData = (rec,serv_type) => {
            try{

                let customrecord_unity_service_usageSearchObj = search.create({
                    type: "customrecord_unity_service_usage",
                    filters: [
                        ["custrecord_ntx_ut_serv_offering", "is", rec.id]
                    ],
                    columns: [
                        search.createColumn({
                            name: "custrecord_ntx_ut_so"
                        }),
                        search.createColumn({
                            name: "custrecord_ntx_ut_cred_expired"
                        }),
                        search.createColumn({
                            name: "custrecord_ntx_ur_cred_consumed"
                        }),
                        search.createColumn({
                            name: "custrecord_ntx_ut_serv_type"
                        }),
                        search.createColumn({
                            name: "custrecord_ntx_ut_sf_order_line_id"
                        }),
                        search.createColumn({
                            name: "custrecord_ntx_ut_cred_purchased"
                        })
                    ]
                });

                let obj_unity_usage = {};
                let arr_sf_order_line = [];

                customrecord_unity_service_usageSearchObj.run().each(function (result) {
                    let _credits_consumed = 0;
                    if (serv_type == MAIN_SERVICE_TYPE.EXPIRED)
                        _credits_consumed = result.getValue('custrecord_ntx_ut_cred_expired');
                    else
                        _credits_consumed = result.getValue('custrecord_ntx_ur_cred_consumed');

                    let _sfdc_so = result.getValue('custrecord_ntx_ut_so');
                    let _sf_req = result.getValue('custrecord_ntx_ut_sf_order_line_id');
                    let _credits_purchased = result.getValue('custrecord_ntx_ut_cred_purchased');
                    let netsuite_so_id = getSOInternalID(_sfdc_so);
                    obj_unity_usage[_sf_req] = {};
                    obj_unity_usage[_sf_req]["_credits_consumed"] = _credits_consumed;
                    obj_unity_usage[_sf_req]["_credits_purchased"] = _credits_purchased;
                    obj_unity_usage[_sf_req]["netsuite_so_id"] = netsuite_so_id;
                    obj_unity_usage[_sf_req]["_unity_usage_id"] = result.id;
                    obj_unity_usage[_sf_req]["_service_type"] = result.getValue('custrecord_ntx_ut_serv_type');
                    arr_sf_order_line.push(_sf_req);

                    //  obj_unity_usage[_sf_req]["netsuite_so_id"] =netsuite_so_id;

                    return true;
                });
                let obj_so = createSalesOrderObj(arr_sf_order_line, obj_unity_usage)
//throw JSON.stringify(obj_so);
                return mergeObjects(obj_unity_usage, obj_so, serv_type);
            }
            catch(e){
                // throw e;
                log.error('err:getServiceUsageData',e);
            }
        }

        const get_details_for_ms = (obj_unity_usage,main_serviceType) => {
            try {
                let __obj_ms_details = {};
                __obj_ms_details[CHILD_SERV_TYPE.CNS_LOB] = {};
                __obj_ms_details[CHILD_SERV_TYPE.EDU_LOB] = {};
                __obj_ms_details['expired'] = {};
                var sf_req_ids = Object.keys(obj_unity_usage);
                for (let a = 0; a < sf_req_ids.length; a++) {
                    //    throw sf_req_ids.length;
                    var _service_type = obj_unity_usage[sf_req_ids[a]]["_service_type"];
                    var support_level = obj_unity_usage[sf_req_ids[a]]["support_level"];
                    var _credits_consumed = parseInt(obj_unity_usage[sf_req_ids[a]]["_credits_consumed"]);
                    var terms =obj_unity_usage[sf_req_ids[a]]["unity_term"] || 12;

                    var _credits_purchased = parseInt(obj_unity_usage[sf_req_ids[a]]["_credits_purchased"]) * (parseInt(terms) / 12);

                    let so_amt = obj_unity_usage[sf_req_ids[a]]["so_amount"];

                    if (main_serviceType == MAIN_SERVICE_TYPE.EXPIRED) {
                        //


                        __obj_ms_details['expired']['_credits_consumed'] = (parseInt(__obj_ms_details['expired']['_credits_consumed']) || 0) + parseInt(_credits_consumed);
                        __obj_ms_details['expired']['_credits_purchased'] = (parseInt(__obj_ms_details['expired']['_credits_purchased']) || 0) + parseInt(_credits_purchased);
                        __obj_ms_details['expired']['netsuite_so_id'] = obj_unity_usage[sf_req_ids[a]]["netsuite_so_id"];
                        __obj_ms_details['expired']['support_level'] = obj_unity_usage[sf_req_ids[a]]["support_level"];
                        __obj_ms_details['expired']['so_item'] = obj_unity_usage[sf_req_ids[a]]["so_item"];


                        __obj_ms_details['expired']['sf_order_line_id'] = obj_unity_usage[sf_req_ids[a]]["sf_order_line_id"];
                        __obj_ms_details['expired']['sf_req_line'] = obj_unity_usage[sf_req_ids[a]]["sf_req_line"];
                        __obj_ms_details['expired']['linenum'] = obj_unity_usage[sf_req_ids[a]]["linenum"];
                        __obj_ms_details['expired']['so_amount'] = obj_unity_usage[sf_req_ids[a]]["so_amount"];

                        __obj_ms_details['expired']['expiry_cns_credits_consumed'] = (parseInt(__obj_ms_details['expired']['expiry_cns_credits_consumed']) || 0) + parseInt(obj_unity_usage[sf_req_ids[a]]["expiry_cns_credits_consumed"]);
                        __obj_ms_details['expired']['expiry_edu_credits_consumed'] = (parseInt(__obj_ms_details['expired']['expiry_edu_credits_consumed']) || 0) + parseInt(obj_unity_usage[sf_req_ids[a]]["expiry_edu_credits_consumed"]);
                        __obj_ms_details['expired']['expiry_cns_ms_amt'] = (parseInt(__obj_ms_details['expired']['expiry_cns_ms_amt']) || 0) + parseInt(obj_unity_usage[sf_req_ids[a]]["expiry_cns_ms_amt"]);
                        __obj_ms_details['expired']['expiry_edu_ms_amt'] = (parseInt(__obj_ms_details['expired']['expiry_edu_ms_amt']) || 0) + parseInt(obj_unity_usage[sf_req_ids[a]]["expiry_edu_ms_amt"]);


                    } else {

                        __obj_ms_details[_service_type]['_credits_consumed'] = (parseInt(__obj_ms_details[_service_type]['_credits_consumed']) || 0) + parseInt(_credits_consumed);
                        __obj_ms_details[_service_type]['_credits_purchased'] = (parseInt(__obj_ms_details[_service_type]['_credits_purchased']) || 0) + parseInt(_credits_purchased);
                        __obj_ms_details[_service_type]['netsuite_so_id'] = obj_unity_usage[sf_req_ids[a]]["netsuite_so_id"];

                        __obj_ms_details[_service_type]['support_level'] = obj_unity_usage[sf_req_ids[a]]["support_level"];
                        __obj_ms_details[_service_type]['so_item'] = obj_unity_usage[sf_req_ids[a]]["so_item"];
                        __obj_ms_details[_service_type]['sf_order_line_id'] = obj_unity_usage[sf_req_ids[a]]["sf_order_line_id"];
                        __obj_ms_details[_service_type]['sf_req_line'] = obj_unity_usage[sf_req_ids[a]]["sf_req_line"];
                        __obj_ms_details[_service_type]['linenum'] = obj_unity_usage[sf_req_ids[a]]["linenum"];
                        __obj_ms_details[_service_type]['so_amount'] = so_amt;
                        __obj_ms_details[_service_type]['sum_ms_amt'] = (parseInt(__obj_ms_details[_service_type]['sum_ms_amt']) || 0) + parseInt(obj_unity_usage[sf_req_ids[a]]["ms_amt"]);



                    }

                }
//throw JSON.stringify(x);
                return __obj_ms_details;
            }
            catch(e){
                // throw e;
                log.error('err:get_details_for_ms',e);
            }

        }

        const getSOInternalID = (sf_so_name) => {
            try{
                var transactionSearchObj = search.create({
                    type: "transaction",
                    filters: [
                        ["custbody_sf_order_number", "is", sf_so_name],
                        "AND",
                        ["mainline", "is", "T"]
                    ]


                });

                let resultSet = transactionSearchObj.run().getRange(0, 1);
                if(resultSet && resultSet.length >0)
                    return resultSet[0].id;
                else return  '';


            }
            catch(e){
                //   throw e;
                log.error('err:getSOInternalID',e);
            }
        }


        const populateDetailsFromMatrix=(prod_code, ms_obj)=>{

            if(!prod_code) return ms_obj;
            let  child_tbl_id='';
            log.debug('prod_code',prod_code);
            try{
                var customrecord_ntx_ms_config_parentSearchObj = search.create({
                    type: "customrecord_ntx_ms_config_parent",
                    filters:
                        [
                            ["custrecord_ntx_ms_config_parent_item.name","startswith",prod_code]
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "custrecord_ntx_ms_config_ct_msname",
                                join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                            }),
                            search.createColumn({
                                name: "custrecord_ntx_ms_config_ct_sec_type",
                                join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                            }),
                            search.createColumn({
                                name: "custrecord_ntx_ms_config_ct_serv_cat",
                                join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                            }),
                            search.createColumn({
                                name: "custrecord_ntx_ms_config_ct_usecase_desc",
                                join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                            }),
                            search.createColumn({
                                name: "custrecord_ntx_ms_config_ct_prop_usecase",
                                join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                            }),
                            search.createColumn({
                                name: "internalid",
                                join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                            })
                        ]
                });
                var searchResultCount = customrecord_ntx_ms_config_parentSearchObj.runPaged().count;

                log.debug("customrecord_ntx_ms_config_parentSearchObj result count",searchResultCount);
                customrecord_ntx_ms_config_parentSearchObj.run().each(function(result){
                    let  ms_name= result.getValue({
                        name: "custrecord_ntx_ms_config_ct_msname",
                        join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                    });
                    let  serv_cat= result.getValue({
                        name: "custrecord_ntx_ms_config_ct_serv_cat",
                        join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                    });
                    let  prop_use_case= result.getValue({
                        name: "custrecord_ntx_ms_config_ct_prop_usecase",
                        join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                    });
                    let  sec_type= result.getValue({
                        name: "custrecord_ntx_ms_config_ct_sec_type",
                        join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                    });
                    let  use_case_desc = result.getValue({
                        name: "custrecord_ntx_ms_config_ct_usecase_desc",
                        join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                    });
                      child_tbl_id = result.getValue({
                        name: "internalid",
                        join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                    });
                      log.debug('child_tbl_id',child_tbl_id)
                    ms_obj.setValue('title',ms_name +'-NCX');
                    ms_obj.setValue('custevent_service_category',serv_cat);
                    ms_obj.setValue('custevent_proposed_use_case',prop_use_case);
                    ms_obj.setValue('custevent_secondary_type',sec_type);
                    ms_obj.setValue('custevent_use_case_description',use_case_desc);


                });



            }
            catch(e){
                log.error('err in pop from matrix',e)
            }
            finally {
                return {'ms_obj':ms_obj,
                'child_tbl_id':child_tbl_id}
            }
        }

        const createMilestoneForProject = (soid, nprojectid, unityCredits,main_serviceType,so_item,ms_amt,prod_code) => {
            try {
                var obj_msId_childId = {};

                var rev_date = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
                var currYearAndQtr = libDO.getCurrentQtrYear(rev_date);

                var currYear = libDO.getProjectYearId(currYearAndQtr.year);
                var currQtr = currYearAndQtr.quarter;
                var exp_rev_date = new Date(new Date().setFullYear(new Date().getFullYear()));

                var exp_currYearAndQtr = libDO.getCurrentQtrYear(rev_date);

                var exp_currYear = libDO.getProjectYearId(exp_currYearAndQtr.year);
                var exp_currQtr = exp_currYearAndQtr.quarter;

                var scriptObj1 = runtime.getCurrentScript();
                var template_non_flex = scriptObj1.getParameter({
                    name: 'custscript_ntx_default_non_flex1'
                });


                //loop number of milestone to be created per quantity
                var copyTemplate = template_non_flex;


                var _newMSRecord = record.copy({
                    type: 'projecttask',
                    id: copyTemplate,
                    isDynamic: true
                });

                _newMSRecord.setValue('company', nprojectid);
                _newMSRecord.setValue('title', 'NCX credits milestone');
                _newMSRecord.setValue('startdate', new Date());
                _newMSRecord.setValue('custevent_ntx_do_related_so', soid);
                _newMSRecord.setValue('custevent_ntx_sku_expiry_date', libDO.dateFormat(rev_date));
                _newMSRecord.setValue('custevent_milestone_quarter', currQtr);
                _newMSRecord.setValue('custevent_milestone_year', currYear);
                _newMSRecord.setValue('custevent_ntx_revenue_date', libDO.dateFormat(rev_date));
                _newMSRecord.setValue('custevent_ntx_unity_credits', unityCredits);
                _newMSRecord.setValue('custevent_ntx_ms_serv_item', so_item);
                _newMSRecord.setValue('custevent_milestone_amount', ms_amt);
                let ms_obj={};
                if (main_serviceType == MAIN_SERVICE_TYPE.EXPIRED) {
                    _newMSRecord.setValue('custevent_ms_status', 8);
                    _newMSRecord.setValue('custevent_ms_status_qualifiers', 74);
                    _newMSRecord.setValue('custevent_ntx_sku_expiry_date', libDO.dateFormat(exp_rev_date));
                    _newMSRecord.setValue('custevent_milestone_quarter', exp_currQtr);
                    _newMSRecord.setValue('custevent_milestone_year', exp_currYear);
                    _newMSRecord.setValue('custevent_ntx_revenue_date', libDO.dateFormat(exp_rev_date));

                }
                else{

                ms_obj = populateDetailsFromMatrix(prod_code,_newMSRecord);
                    _newMSRecord=ms_obj.ms_obj;
                }

                let _msId = _newMSRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });
                obj_msId_childId["_" + _msId] = {};

                obj_msId_childId["_" + _msId]['quantity'] = 1;//_msObj['quantity'];
                //  obj_msId_childId["_" + _msId]['linenum'] = 1;//_msObj['linenum'];
                obj_msId_childId["_" + _msId]['childId'] = ms_obj.child_tbl_id || so_item;
                obj_msId_childId["_" + _msId]['_appendChild'] =false;// _msObj['_appendChild'];
                obj_msId_childId["_" + _msId]["msid"] = _msId;
                obj_msId_childId["_" + _msId]["itemid"] = so_item;//_msObj['_childId'];
                //  obj_msId_childId["_" + _msId]["removed_childIds"] = _msObj['removed_childIds'];
                // obj_msId_childId["_" + _msId]["removed_childIds_quan"] = _msObj['removed_childIds_quan'];
                createEstimatedEffort(obj_msId_childId);
                return _msId;

            }
            catch(e){
                //  throw e;
                log.error('err while creating ms',e);
            }


        }

        function createEstimatedEffort(obj_msId_childId) {

            var _arrChildId = libDO.getKeysFromObject(obj_msId_childId, 'childId', false); //_arrChildId.map(function(x){ return x.replace(/_/g,"") });

             log.debug('_arrChildId: ', _arrChildId); //Temp Log

            if (_arrChildId.length > 0) {
                var allMsIds = Object.keys(obj_msId_childId);

                // log.debug('allMsIds: ', allMsIds); //Temp Log

                var _searchObj3 = libDO.getEstimateHourSearchRes(_arrChildId);
              
                var myResultSet3 = _searchObj3.run();

                //log.debug('myResultSet3: ', myResultSet3.length); //Temp Log

                var resultRange3 = myResultSet3.getRange({
                    start: 0,
                    end: 1000
                });
log.debug('resultRange3',resultRange3.length);
                for (var gg = 0; gg < allMsIds.length; gg++) {
                    var msValue = obj_msId_childId[allMsIds[gg]];
                    var ms_ChildId = msValue['childId'];

                   libDO.CreateEffortHrs(obj_msId_childId, msValue, resultRange3);

                }
            }


        }

       /* function CreateEffortHrs(obj_msId_childId, msValue, results) {
            var effortStorage = {};
            var ms_ChildId = msValue['childId'];
            var msid = msValue['msid'];
            var _qty = msValue['quantity'];
            log.debug('effort hrs 2',msid +"::"+_qty);
            for (var ii = 0; results && ii < results.length; ii++) {
                try {
                    var _formulaEffortHrs = results[ii].getValue("custrecord_ntx_ms_config_et_form_esthrs");
                    var _effortHrs = results[ii].getValue("custrecord_ntx_ms_config_et_esthrs");
                    var _costRate = results[ii].getValue("custrecord_ntx_ms_config_et_cost_rate");
                    var _resType = results[ii].getValue("custrecord_ntx_ms_config_et_res_type");
                    var _child = results[ii].getValue("custrecord_ntx_ms_config_et_child");
                    var childItemId = results[ii].getValue({name:"custrecord_ntx_ms_config_ct_child_item",join: 'CUSTRECORD_NTX_MS_CONFIG_ET_CHILD'});
                    var _adj = results[ii].getValue({name:"custrecord_ntx_ms_config_ct_adjust",join: "CUSTRECORD_NTX_MS_CONFIG_ET_CHILD"});

                    var _base = results[ii].getValue({name:"custrecord_ntx_ms_config_ct_base",join: "CUSTRECORD_NTX_MS_CONFIG_ET_CHILD"});
                    var _hyp = results[ii].getValue({name:"custrecord_ntx_ms_config_ct_hyp",join: "CUSTRECORD_NTX_MS_CONFIG_ET_CHILD"});
                    log.debug('ms_ChildId es',ms_ChildId +"::"+_child)
                    if (ms_ChildId != _child) {
                        continue;
                    }

                    if (_formulaEffortHrs) {
                        _effortHrs = libDO.calculate_effortHrs_fromFormula(_formulaEffortHrs, _adj, _base, _hyp, _qty, obj_msId_childId, msid, _resType);
                        log.debug('_effortHrs',_effortHrs)
                        _effortHrs = libDO.toFixed(_effortHrs);
                        obj_msId_childId["_" + msid][RESOURCETYPE[_resType]] = _effortHrs;
                    }
                    if (!_resType) continue;
                    if (_effortHrs) _effortHrs = Math.round(_effortHrs);
                    var rec_estimateHours = record.create({
                        type: 'customrecord_estimated_efforts',
                        isDynamic: true
                    });
                    rec_estimateHours.setValue('custrecord_ef_resource_type', _resType);
                    rec_estimateHours.setValue('custrecord_ef_project_task', msid); // set milestone id

                    rec_estimateHours.setValue('custrecord_ef_cost_rate', _costRate);
                    rec_estimateHours.setValue('custrecord_ef_estimated_hours', _effortHrs);


                    var estimateEffortId = rec_estimateHours.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });

                    if (estimateEffortId)
                        log.debug('estimateEffortId: ', estimateEffortId);

                } catch (e) {
                    log.error('CreateEffortHrs' + msid, e);
                }

            }
        }*/

        const createDOAllocation = (doId, ms_id, newSofDetailId,percent_alloc) => {
            try {
                let doAllocation = record.create({
                    type: 'customrecord_ntx_so_flex_allocation'
                });

                doAllocation.setValue({
                    fieldId: 'custrecord_ntx_so_flex_alloc_fin_do_link',
                    value: doId
                });


                doAllocation.setValue({
                    fieldId: 'custrecord_ntx_so_flex_alloc_fin_do_stat',
                    value: '1'
                });
                doAllocation.setValue({
                    fieldId: 'custrecord_ntx_so_flex_alloc_fin_rel_ms',
                    value: ms_id
                });
                doAllocation.setValue({
                    fieldId: 'custrecord_ntx_so_flex_alloc_fin_detail',
                    value: newSofDetailId
                });

                doAllocation.setValue({
                    fieldId: 'custrecord_ntx_so_flex_alloc_perc_skurev',
                    value: percent_alloc
                });

                //custrecord_ntx_doalloc_credits_purchased
                let _allocationId = doAllocation.save();
                log.debug('_allocationId', _allocationId);
            }catch(e){
                //  throw e;
                log.error('err with creating do alloc',e);
            }
        }


        const calculateRevenuePercentage =(obj_unity_usage,main_serviceType)=> {

            try {
                let unity_sf_req_ids = Object.keys(obj_unity_usage);

                for (let a = 0; a < unity_sf_req_ids.length; a++) {
                    let usageId = obj_unity_usage[unity_sf_req_ids[a]]["_unity_usage_id"];

                    let total_credits = obj_unity_usage[unity_sf_req_ids[a]]["_credits_purchased"];
                    let total_consumed = obj_unity_usage[unity_sf_req_ids[a]]["_credits_consumed"];
                    let __terms =obj_unity_usage[unity_sf_req_ids[a]]["unity_term"];
                    let terms = parseInt(__terms) / 12;
                    if (!obj_unity_usage[unity_sf_req_ids[a]]["unity_term"]) terms = 1;
                    let support_level = obj_unity_usage[unity_sf_req_ids[a]]["support_level"]
                    let child_serv_type = obj_unity_usage[unity_sf_req_ids[a]]["_service_type"];

                    let rev_percent = {};
                    // throw total_credits +" :: "+terms
                    let total_credits_for_entire_term = parseFloat(total_credits) * parseFloat(terms);

                    if (main_serviceType == MAIN_SERVICE_TYPE.EXPIRED) {


                        let edu_percent = support_level == 'ADVANCED' ? PERCENTAGES.EDU_BETTER : PERCENTAGES.EDU_BEST;


                        rev_percent.custrecord_ntx_ut_percent_recognized_edu = (parseFloat(edu_percent) * parseFloat(total_consumed) / parseFloat(total_credits)).toFixed(2);
                        ;

                        let services_percent = support_level == 'ADVANCED' ? PERCENTAGES.CNS_BETTER : PERCENTAGES.CNS_BEST;
                        rev_percent.custrecord_ntx_ut_percent_recognized = (parseFloat(services_percent) * parseFloat(total_consumed) / parseFloat(total_credits)).toFixed(2);
                        ;


                    } else {
                        //    throw total_consumed +" ::  "+total_credits_for_entire_term;

                        rev_percent.custrecord_ntx_ut_percent_recognized = ((total_consumed / total_credits_for_entire_term) * 100).toFixed(2);
                    }

                    record.submitFields({
                        type: 'customrecord_unity_service_usage',
                        id: usageId, values: rev_percent
                    });


                }
            }
            catch(e){
                // throw e;
                log.error('err:calculateRevenuePercentage',e);
            }


        }
        function createServiceProject (main_serviceType,obj_unity_usage,__obj_so_details,prod_code){
            try {
                let nprojectid='';
                let obj_so_details;
                let ms_amt = 0;
                let percent_alloc = 0;
                if (main_serviceType == MAIN_SERVICE_TYPE.EXPIRED) {
                    obj_so_details = __obj_so_details['expired'];
                    ms_amt = obj_so_details.expiry_cns_ms_amt;

                    //  {"_credits_consumed":210,"_credits_purchased":1300,"netsuite_so_id":"16926164","support_level":"ADVANCED","so_item":"101323","sf_order_line_id":"a340e0000007QwOAAU","sf_req_line":"","linenum":"1","so_amount":"1264607.16","expiry_cns_credits_consumed":139,"expiry_edu_credits_consumed":71}


                } else {
                    obj_so_details = __obj_so_details[CHILD_SERV_TYPE.CNS_LOB];

                    ms_amt = obj_so_details.sum_ms_amt;
                    //  ms_amt = obj_so_details.expiry_cns_ms_amt;

                }

                let sum_of_credits_consumed = obj_so_details._credits_consumed;

                let recent_so_id = obj_so_details.netsuite_so_id;

                let so_item = obj_so_details.so_item;


                let ms_expired_credits = obj_so_details['cns_credits_consumed'];//p*sum_of_credits_consumed/100;


                var _scriptObj = runtime.getCurrentScript();
                const templateid = _scriptObj.getParameter({
                    name: 'custscript_ntx_default_project_template'
                });
                let soRec = record.load({
                    type: 'salesorder',
                    id: recent_so_id
                });
                nprojectid = libDO.createProjectFromSO(templateid, soRec);

                sum_of_credits_consumed = main_serviceType == MAIN_SERVICE_TYPE.EXPIRED ? ms_expired_credits : sum_of_credits_consumed;

                let ms_id = createMilestoneForProject(recent_so_id, nprojectid, sum_of_credits_consumed, main_serviceType, so_item, ms_amt,prod_code);
                log.debug('nprojectid', nprojectid + ":" + ms_id);

                var sf_req_ids = Object.keys(obj_unity_usage);
                for (let a = 0; a < sf_req_ids.length; a++) {
//throw JSON.stringify(obj_unity_usage[sf_req_ids[a]]) +"||||"+ JSON.stringify(obj_so_details);
                    let so_id = obj_unity_usage[sf_req_ids[a]]["netsuite_so_id"];

                    let so_item = obj_unity_usage[sf_req_ids[a]]["so_item"];
                    let percent_alloc=0;
                    if (main_serviceType == MAIN_SERVICE_TYPE.EXPIRED) {
                        percent_alloc = obj_unity_usage[sf_req_ids[a]]["expiry_cns_do_alloc_percent"];
                    }
                    else{
                        percent_alloc = obj_unity_usage[sf_req_ids[a]]["do_alloc_percent"];

                    }
                    //  throw JSON.stringify(__obj_so_details) +"|||"+JSON.stringify(obj_unity_usage[sf_req_ids[a]]);
                    let salesorderObj = record.load({
                        type: 'salesorder',
                        id: so_id
                    });


                    let sofId = getRelatedSOF(so_id);
                    if (!sofId)
                        sofId = libDO.createSOFinanceHeader(salesorderObj);
                    let sofdetailId = createSOFDetail(sofId, nprojectid, obj_unity_usage[sf_req_ids[a]]);
                    log.debug('sofdetailId', sofdetailId)
                    //  libDO.createDoAllocation(obj_msId_childId, sofdetailId, false);
                    createDOAllocation(nprojectid, ms_id, sofdetailId, percent_alloc);
                    //    throw nprojectid;

                }


                return nprojectid;
            }
            catch(e){
                //throw e;
                log.error('err while creating serv projec',e);
            }

        }
        function createSOFDetail(sofid, proj_id, __obj) {

            var sofDetailRecObj = record.create({
                type: 'customrecord_ntx_so_finance_details',
                isDynamic: true
            });

            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_do', proj_id);
            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_header', sofid); // set milestone id


//throw JSON.stringify(__obj);
            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_sf_req_ord_lin', __obj['sf_req_line']); // set milestone id
            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_sf_ord_line_id', __obj['sf_order_line_id']); // set milestone id
            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_so_line_id', __obj['linenum']); // set milestone id



            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_amount', __obj['so_amount']);
            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_item', __obj['so_item']);
            /*  sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_quantity', flex_ms_obj['quantity']);
              sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_amount', flex_ms_obj['totalamount']);
              sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_flexunitprice', flex_ms_obj['amount']);*/



            //  sofDetailRecObj.setFieldValue('custrecord_ntx_so_fin_dts_sf_ord_line_id', '');

            var sofDetailRecId = sofDetailRecObj.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            return sofDetailRecId;
        }
        return {

            get_details_for_ms:get_details_for_ms,
            createMilestoneForProject:createMilestoneForProject,
            createDOAllocation:createDOAllocation,
            getServiceUsageData:getServiceUsageData,

            calculateRevenuePercentage:calculateRevenuePercentage,
            createEDUProject:createEDUProject,
            createServiceProject:createServiceProject
        };

    });