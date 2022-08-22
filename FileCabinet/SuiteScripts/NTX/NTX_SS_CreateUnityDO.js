/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
/*
* 2.0 shobiya aug 11 2022 BA-91124
* */
define(['N/record', 'N/runtime', 'N/search', '/SuiteScripts/NTX/NTX_Library_Delivery_Order', '/SuiteScripts/NTX/NTX_Lib_HistoricalRecords', '/SuiteScripts/NTX/NTX_lib_expandms_2.1'],

    (record, runtime, search, libDO, libHist, lib_expandMs) => {

        const execute = (scriptContext) => {
            log.debug('starting', new Date().getTime());
            //
            let _scriptObj = runtime.getCurrentScript();
            //(do not delete)unity so search
            const unity_search = _scriptObj.getParameter({
                name: 'custscript_ntx_uty_search'
            });
            let unity_so = search.load({
                id: unity_search
            });


            const templateid = _scriptObj.getParameter({
                name: 'custscript_ntx_default_project_template'
            });
            const template_non_flex = _scriptObj.getParameter({
                name: 'custscript_ntx_default_non_flex1'
            });
            log.debug('ids', templateid + "::" + template_non_flex)

            unity_so.run().each(function (result) {
                try {
                    let so_id = result.getValue({
                        name: 'internalid',
                        summary: 'GROUP'
                    });
                    log.debug('processing so', so_id);

                    let __oSupportLines = create__oSupportLines(so_id);
                    log.debug('support lines', JSON.stringify(__oSupportLines))
                    create_unity_do(so_id, __oSupportLines, templateid, template_non_flex);
                } catch (e) {
                    log.error('test', e);
                }
                return true;
            });

        }


        /**
         * Gets a list of the unity lines (support level is Advanced or Premium and the unity term is populated),
         * @param so_id
         * @returns {*[]}  object per line of the SO.
         */
        const create__oSupportLines = (so_id) => {
            var salesorderSearchObj = search.create({
                type: "salesorder",
                filters: [
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["custcol_support_level", "isnotempty", ""],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    [["custcol_support_level", "is", "Advanced"], "OR", ["custcol_support_level", "is", "Premier"]],
                    "AND",
                    ["custcol_unity_credit_term", "isnotempty", ""],
                    "AND",
                    ["internalidnumber", "equalto", so_id]
                ],
                columns: [
                    search.createColumn({
                        name: "line"
                    }),
                    search.createColumn({
                        name: "linesequencenumber"
                    }),
                    search.createColumn({
                        name: "item"
                    }),
                    search.createColumn({
                        name: "custcol_support_level"
                    }),
                    search.createColumn({
                        name: "custcol_unity_credit_term"
                    }),
                    search.createColumn({
                        name: "custcol_sf_order_line_id"
                    }),
                    search.createColumn({
                        name: "custcol_sf_order_required_by_line"
                    }),
                    search.createColumn({
                        name: "amount"
                    }),
                    search.createColumn({
                        name: "quantity"
                    }),
                    search.createColumn({
                        name: "custcol_ntnx_arm_rr_start_date"
                    }),
                    search.createColumn({
                        name: "custcol_ntnx_arm_rr_end_date"
                    }),
                    search.createColumn({
                        name: "custcol_unity_credits"
                    })
                ]
            });
            let obj_soItems = [];
            salesorderSearchObj.run().each(function (result) {
                let obj_soItem = {
                    itemname: result.getText('item'),
                    so_id: so_id,
                    itemid: result.getValue('item'),

                    amount: result.getValue('amount'),
                    quantity: result.getValue('quantity'),
                    linenum: result.getValue('line'),

                    sf_line: result.getValue('custcol_sf_order_line_id'),
                    sf_req: result.getValue('custcol_sf_order_required_by_line'),

                    support_level: result.getValue('custcol_support_level'),
                    unity_term: result.getValue('custcol_unity_credit_term'),
                    arm_sd: result.getValue('custcol_ntnx_arm_rr_start_date'),
                    arm_ed: result.getValue('custcol_ntnx_arm_rr_end_date'),
                    ncx_creds: result.getValue('custcol_unity_credits')
                };
                obj_soItems.push(obj_soItem);
                return true;
            });
            return obj_soItems;
        }


        const create_ms = (nprojectid, term_in_months, template_non_flex, _msObj, sd, ed) => {
            let obj_msId_childId = {};
            // let arr_msId = [];
//get perday cred, per day amt
            var date = new Date(sd);

            var enddate = new Date(ed);

            var mon_diff = lib_expandMs.monthDiff(sd, ed);// lib_expandMs.getNumberOfDays
            var totalDays = lib_expandMs.getNumberOfDays(sd, ed);
            var per_day_ncx_cred = lib_expandMs.calc_singledayflexcred(sd, ed, _msObj.ncx_creds);

            var per_day_ncx_amt = lib_expandMs.calc_singledayflexcred(sd, ed, _msObj.amount);
            let _flds_for_rec = {};


            //    "custevent_ntx_do_related_so": "so_id"
            _flds_for_rec.startdate = sd;
            _flds_for_rec.enddate = ed;

            _flds_for_rec.name = _msObj.itemname; //newRec.getValue('custrecord_ntx_do_ms_name')
            _flds_for_rec.proj_id = nprojectid;
            _flds_for_rec.item = _msObj.itemid;//serviceItem;


            _flds_for_rec.notMRR = true;
            _flds_for_rec.ncx = true;
            _flds_for_rec.total_ncx_creds = _msObj.ncx_creds;
            _flds_for_rec.per_day_ncx_cred = per_day_ncx_cred;
            _flds_for_rec.per_day_ncx_amt = per_day_ncx_amt;
            _flds_for_rec.so_id = _msObj.so_id;
            _flds_for_rec.term_in_months = term_in_months;


            let obj_lastMSDetails = lib_expandMs.Create_records_for_dates(_flds_for_rec);


            obj_lastMSDetails.forEach(ms => {
                let _msId = ms.ms_id;
                let __ncx_cred_for_month = ms.__ncx_cred_for_month;


                obj_msId_childId["_" + _msId] = {};

                obj_msId_childId["_" + _msId]['quantity'] = 1;

                obj_msId_childId["_" + _msId]["msid"] = _msId;
                obj_msId_childId["_" + _msId]["itemid"] = _msObj['itemid'];

                obj_msId_childId["_" + _msId]["amount"] = ms.ms_amt_for_month;
                obj_msId_childId["_" + _msId]["sf_line"] = _msObj['sf_line'];
                obj_msId_childId["_" + _msId]["sf_req"] = _msObj['sf_req'];
                obj_msId_childId["_" + _msId]["linenum"] = _msObj['linenum'];
                obj_msId_childId["_" + _msId]["_salePrice"] = '100'//_msObj['_salePrice'];
                obj_msId_childId["_" + _msId]["parentId"] = _msObj['itemid'];


            });

            return obj_msId_childId;
        }

        /**
         *
         * @param so_id so internal id
         * @param __oSupportLines arr of lines from the SO
         * @param templateid
         * @param template_non_flex
         */
        const create_unity_do = (so_id, __oSupportLines, templateid, ms_template_non_flex) => {
            let soRec = record.load({
                type: record.Type.SALES_ORDER,
                id: so_id
            });

            __oSupportLines.forEach(soLine => {
                let line_number = soLine.linenum;
                let support_level = soLine.support_level;
                let sd = soLine.arm_sd;
                let ed = soLine.arm_ed;
                let unity_term = soLine.unity_term;
                let term_in_months = parseInt(unity_term);

                const ITEMS = {};
                let __len = 0;

                switch (support_level) {
                    case 'Advanced': //one project

                        __len = 1;
                        break;
                    case 'Premier': //res & tami
                        __len = 2;

                        break;
                    default:
                        log.debug('support level not recognized');
                        break;
                }
                log.debug('Object.keys(ITEMS).length', Object.keys(ITEMS).length);
                if (__len > 0) {
                    let sofId = libHist.getRelatedSOF(so_id);
                    let alreadyCreated = false;
                    if(1==1){
                   // if (!sofId) {
                        sofId = libDO.createSOFinanceHeader(soRec);
                    } else {
                        alreadyCreated = doesSOFDetailExists(sofId, soLine.sf_line);
                    }
                    alreadyCreated = false;//temp
                    if (!alreadyCreated) {
                        // for (const property in ITEMS) {
                        //for (let k = 0; k < __len; k++) {
                        // __oSupportLines[line_number]['itemid'] = property;
                        //__oSupportLines[line_number]['itemname'] = ITEMS[property];
                        let nprojectid = libDO.createProjectFromSO(templateid, soRec);
                        log.debug('nprojectid', nprojectid);
                        let obj_msId_childId = create_ms(nprojectid, term_in_months, ms_template_non_flex, soLine, sd, ed);
                        const sofdetailId = libDO.createSOFDetail(sofId, nprojectid, null, '');
                        libDO.createDoAllocation(obj_msId_childId, sofdetailId, false);
                        //}
                    } else {
                        log.debug('alreadyCreated', 'sof detail already created, assuming do/milestone exists.');
                    }
                }
            });
        }

        /**
         * Checks is a sofdetail record has been created for this line
         * @param sofId
         * @param linenum
         * @returns {boolean}
         */
        const doesSOFDetailExists = (sofId, sf_line) => {
            var sofDetailSearch = search.create({
                type: "customrecord_ntx_so_finance_details",
                filters: [
                    ["custrecord_ntx_so_fin_dts_header", "anyof", sofId],
                    "AND",
                    ["custrecord_ntx_so_fin_dts_sf_ord_line_id", "is", sf_line],
                ]
            });
            let found = false;
            sofDetailSearch.run().each(function (result) {
                found = true;
                return false;
            });
            return found;
        }

        return {
            execute
        }
    });