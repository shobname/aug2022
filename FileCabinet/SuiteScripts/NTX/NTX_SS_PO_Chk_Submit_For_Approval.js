/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
/*
* */
define([ 'N/search','N/record','N/runtime'],

    ( search,record,runtime) => {


        const execute = (scriptContext) => {
            try {
                var scriptObj = runtime.getCurrentScript();
                let __searchId = scriptObj.getParameter({
                    name: 'custscript_ntx_po_after_comp_chck'
                });
                var po_list = search.load({
                    id: __searchId
                });
                po_list.run().each(function (result) {
                    try {
                        let po_id = result.id;
                        let _next_approver = result.getValue({
                            name: "purchaseorderapprover",
                            join: "CUSTBODY_PO_REQUESTED_BY",
                        });
                        record.submitFields({
                            type: 'purchaseorder',
                            id: po_id,
                            values: {
                                nextapprover:_next_approver,
                                custbody_submit_for_approval: true
                            }
                        });

                    } catch (e) {
                        log.error('test', e);
                    }
                    return true;
                });

            } catch (e) {

                log.debug('error', e);
            }
        }



        return {execute}

    });
