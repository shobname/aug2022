/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
/*
* 1.0       shobiya             march 2022      BA-88628 Project Unity: Credits consumption
* */
define(['N/record', 'N/runtime', 'N/search', '/SuiteScripts/NTX/NTX_Library_Delivery_Order','/SuiteScripts/NTX/NTX_lib_unity_project'],

    (record, runtime, search, libDO,libUnity) => {





        const afterSubmit = (scriptContext) => {

            const  ALL_SERVICE_TYPE = {
                EDU: 1,
                SERVICES: 2,
                EXPIRED: 3
            }
            let _type = scriptContext.type;
            if (_type == 'edit' || _type == 'xedit') {
                let rec = scriptContext.newRecord;
                let oldrec = scriptContext.oldRecord;
                let newChk=rec.getValue('custrecord_ntx_ncx_ready_create_do');
                let oldChk=oldrec.getValue('custrecord_ntx_ncx_ready_create_do');
                log.debug('test'+newChk, oldChk);
                if (newChk== true && oldChk != true) {


                    let main_serviceType = rec.getValue('custrecord_unity_service_type');
                    let prod_code = rec.getValue('custrecord_product_code');
                    // var _scriptObj = runtime.getCurrentScript();

                    log.debug('type', scriptContext.type);


//if(1==1){
                    let obj_unity_usage = libUnity.getServiceUsageData(rec, main_serviceType);

                    let obj_so_details = libUnity.get_details_for_ms(obj_unity_usage, main_serviceType);

                    let child_lob_type = '';


                    //get type, unity credits,
                    if (main_serviceType == ALL_SERVICE_TYPE.EXPIRED) {
                        //create edu, servi project
                        let eduProjectId = libUnity.createEDUProject(main_serviceType, obj_unity_usage, obj_so_details);
                        let nprojectId = libUnity.createServiceProject(main_serviceType, obj_unity_usage, obj_so_details,prod_code);
                        libUnity.calculateRevenuePercentage(obj_unity_usage, main_serviceType);


                        record.submitFields({
                            type: 'customrecord_unity_service_offerring',
                            id: rec.id, values: {
                                'custrecord_ntx_ns_new_do': nprojectId,
                                'custrecord_ntx_ns_new_do_edu': eduProjectId,
                                'custrecord_ntx_ns_new_do_edu_link': eduProjectId,
                                'custrecord_ntx_ns_new_do_serv_link': nprojectId

                            }
                        });


                    } else {

                        var size = Object.keys(obj_so_details).length;

                        let arr_child_lobs = Object.keys(obj_so_details);

                        if (size > 0) {
                            for (let a = 0; a < arr_child_lobs.length; a++) {

                                child_lob_type = arr_child_lobs[a];

                                if (child_lob_type == ALL_SERVICE_TYPE.EDU && Object.keys(obj_so_details[child_lob_type]).length > 0) {

                                    let eduProjectId = libUnity.createEDUProject(main_serviceType, obj_unity_usage, obj_so_details);
                                    record.submitFields({
                                        type: 'customrecord_unity_service_offerring',
                                        id: rec.id,
                                        values: {
                                            'custrecord_ntx_ns_new_do_edu': eduProjectId,
                                            'custrecord_ntx_ns_new_do_edu_link': eduProjectId
                                        }
                                    });

                                } else if (child_lob_type == ALL_SERVICE_TYPE.SERVICES && Object.keys(obj_so_details[child_lob_type]).length > 0) {

                                    let nprojectId = libUnity.createServiceProject(main_serviceType, obj_unity_usage, obj_so_details,prod_code);
                                    record.submitFields({
                                        type: 'customrecord_unity_service_offerring',
                                        id: rec.id,
                                        values: {
                                            'custrecord_ntx_ns_new_do': nprojectId,
                                            'custrecord_ntx_ns_new_do_serv_link': nprojectId
                                        }
                                    });
                                }

                            }

                        }


//throw main_serviceType;
                        libUnity.calculateRevenuePercentage(obj_unity_usage, main_serviceType);

                    }
                }
            }

        }





        return {

            afterSubmit
        }

    });