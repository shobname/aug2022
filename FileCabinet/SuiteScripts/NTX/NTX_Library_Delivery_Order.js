/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 *
 * V2.0    	22 Dec,2021          Kenneth     BA-84800 Create Flex Dashboard for Each SKU in SO
 * v3.0		march 10 22.  		shobiya  	  BA-87793 Duplicate Milestones Created for CNS-INF-A-SVC-DEP-STR
 * v4.0	march 29 2022		deepan 	 BA-89238 WaR SOFs and MS are not linking to sold Sales Order
 * 4.1			june 15 22		shobiya BA-88227
 *4.2			shobiya		july 4 2022. BA-91199
 */
define(['N/error', 'N/record', 'N/runtime', 'N/search', '/SuiteScripts/NTX/NTX_Lib_Estimated_Effort_Hours_MS_Project_SSV2', 'N/url', 'N/format'],
    /**
     * @param {error} error
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     * @param {url} url
     */
    function(error, record, runtime, search, libestimatedhrs, url, format) {

        var _script_obj = runtime.getCurrentScript();

        var SF_REQ_AMT = {};
        var SF_REQ_UP = {};
        //  var RESOURCETYPE={};
        function getResourceType() {
            var RESOURCETYPE = {};
            let SEARCH_RESOURCE_LIST = _script_obj.getParameter({
                name: 'custscript_ntx_so_resource_list1'
            });


            var resSearch = search.load({
                id: SEARCH_RESOURCE_LIST
            });

            var resultSet = resSearch.run();
            var _searchres = resultSet.getRange({
                start: 0,
                end: 50
            });

            for (var ii = 0; ii < _searchres.length; ii++) {
                var _id = _searchres[ii].id.toString();
                var _name = _searchres[ii].getValue('name');
                RESOURCETYPE[_id] = _name;
            }

            return RESOURCETYPE;

        }

        function createSOItemObject(salesorderObj) {

            var obj_soItems = {};
            try {

                var lines = salesorderObj.getLineCount('item');

                log.debug('SOLineItemCount:', lines);

                for (var ii = 0; ii < lines; ii++) {
                    var itemtext = salesorderObj.getSublistValue('item', 'custcol9', ii);
                    var itemid = salesorderObj.getSublistValue('item', 'item', ii);
                    var quantity = Math.round(salesorderObj.getSublistValue('item', 'quantity', ii));
                    var amount = salesorderObj.getSublistValue('item', 'rate', ii);
                    var linenum = salesorderObj.getSublistValue('item', 'line', ii);
                    var _sf_order_line_id = salesorderObj.getSublistValue('item', 'custcol_sf_order_line_id', ii);
                    var _sf_req_by_order_num = salesorderObj.getSublistValue('item', 'custcol_sf_order_required_by_line', ii);
                    var _linenum = "_" + linenum;
                    var global_list_price = salesorderObj.getSublistValue('item', 'custcol_global_list_price', ii);
                    //log.debug('LineInfo:','itemtxt: '+itemtext +',itemid: '+itemid+',qty: '+quantity+',amt: '+amount+',linenum: '+linenum+',_sf_order_line_id: '+_sf_order_line_id);

                    obj_soItems[_linenum] = {};
                    obj_soItems[_linenum]["itemname"] = itemtext;
                    obj_soItems[_linenum]["itemid"] = itemid;
                    obj_soItems[_linenum]["amount"] = amount;
                    obj_soItems[_linenum]["quantity"] = quantity;
                    obj_soItems[_linenum]["sf_line"] = _sf_order_line_id;
                    obj_soItems[_linenum]["linenum"] = linenum;
                    obj_soItems[_linenum]["sf_req"] = _sf_req_by_order_num; //this is empty for parent
                    obj_soItems[_linenum]["global_list_price"] = global_list_price;

                }
            } catch (e) {
                log.error('in createSOItemObject', e);
            } finally {
                return obj_soItems;
            }
        }

        function soNeedProject(obj_soItems) {

            let SEARCH_CHECK_PROJ = _script_obj.getParameter({
                name: 'custscript_ntx_check_need_proj1'
            });

            var _PARENT = [];
            var _CHILD = [];
            var soItems = [];
            var soItemToCreateProject = {};
            var s_linenum = Object.keys(obj_soItems);

            for (var p = 0; p < s_linenum.length; p++) { //sales order items
                var line_number = s_linenum[p];
                soItems.push(obj_soItems[line_number]["itemid"]);
            }
            if (soItems.length == 0) return false;

            var searchObj1 = search.load({
                id: SEARCH_CHECK_PROJ
            });

            var searchObj1_Filter = searchObj1.filters; //reference Search.filters object to a new variable

            searchObj1_Filter.push(search.createFilter({
                name: 'custrecord_ntx_ms_config_parent_item',
                join: 'custrecord_ntx_ms_config_ct_parent_item',
                operator: search.Operator.ANYOF,
                values: soItems
            }));

            searchObj1_Filter.push(search.createFilter({
                name: 'custrecord_ntx_ms_config_ct_child_item',
                join: null,
                operator: search.Operator.ANYOF,
                values: soItems
            }));

            var _searchObj1 = search.create({
                type: searchObj1.searchType,
                columns: searchObj1.columns,
                filters: searchObj1_Filter
            });

            var resultSet1 = _searchObj1.run();

            var results1 = resultSet1.getRange({
                start: 0,
                end: 1000
            });

            for (var ff = 0; results1 && ff < results1.length; ff++) {
                var parentId = results1[ff].getValue({
                    name: "custrecord_ntx_ms_config_parent_item",
                    join: "CUSTRECORD_NTX_MS_CONFIG_CT_PARENT_ITEM"
                });
                var childId = results1[ff].getValue({
                    name: "custrecord_ntx_ms_config_ct_child_item",
                    label: "Child Item"
                })
                _PARENT.push(parentId);
                _CHILD.push(childId);
            }

            _PARENT = _PARENT.filter(onlyUnique);
            _CHILD = _CHILD.filter(onlyUnique);
            soItemToCreateProject.parent = _PARENT;
            soItemToCreateProject.child = _CHILD;
            return soItemToCreateProject;

        }

        function filter_soItemObject(soItemObject, objSoItemToCreateProject) {
            var parent = objSoItemToCreateProject.parent;
            var child = objSoItemToCreateProject.child;
            var soItemToCreateProject = parent.concat(child);
            var s_linenum = Object.keys(soItemObject);

            for (var p = 0; p < s_linenum.length; p++) { //sales order items
                var line_number = s_linenum[p];
                var ___id = (soItemObject[line_number]["itemid"]);
                var fff = soItemToCreateProject.indexOf(___id);
                if (soItemToCreateProject.indexOf(___id) == -1) {
                    delete soItemObject[line_number];

                }
            }
            return soItemObject;

        }

        function createFilterString(obj_parentChild) {
            var _keys = Object.keys(obj_parentChild);
            var arr = [];
            for (var p = 0; p < _keys.length; p++) { //sales order items
                var line_number = _keys[p];
                var parent = obj_parentChild[line_number]["parent"];

                var child = obj_parentChild[line_number]["child"];
                arr.push(
                    [
                        ["custrecord_ntx_ms_config_ct_parent_item.custrecord_ntx_ms_config_parent_item", 'anyof', [parent]],
                        'and', ["custrecord_ntx_ms_config_ct_child_item", 'anyof', [child]]
                    ], 'or');
                arr.push(
                    [
                        ["custrecord_ntx_ms_config_ct_parent_item.custrecord_ntx_ms_config_parent_item", 'anyof', [child]],
                        'and', ["custrecord_ntx_ms_config_ct_child_item", 'anyof', [child]]
                    ], 'or');

            }
            arr.pop();
            var arrFilter = [
                ['isinactive', 'is', 'F'],
                'and',
                ['custrecord_ntx_ms_config_ct_parent_item.isinactive', 'is', 'F'],

                'and',
                [arr]
            ]
            return arrFilter;

        }

        function transferValueToNewObj(obj_soItems, new_so_obj, k) {
            try {
                var _keys = Object.keys(obj_soItems);
                for (var p = 0; p < _keys.length; p++) {
                    new_so_obj[k][_keys[p]] = obj_soItems[_keys[p]];
                }
            } catch (e) {
                log.error('in transferValueToNewObj', e)
            }
            return new_so_obj;
        }

        function getSfId(_parentId, _childId, obj_parentChild) {
            var sfId = [];
            try {
                var sf_lineIds = Object.keys(obj_parentChild);


                for (var p = 0; p < sf_lineIds.length; p++) { //sales order items
                    var line_number = sf_lineIds[p];
                    var parentId = obj_parentChild[line_number]["parent"];
                    var childId = obj_parentChild[line_number]["child"];
                    var c_sf_line = obj_parentChild[line_number]["c_sf_line"];
                    var c_sf_req = obj_parentChild[line_number]["c_sf_req"]; //null but main
                    if (_parentId == parentId && _childId == childId) {
                        sfId.push(c_sf_req);
                    }
                }
            } catch (e) {

            }
            return sfId;
        }

        function sofExist(soid) {
            let filters = [];
            filters.push({
                "name": "custrecord_ntx_so_finance_so",
                "operator": "anyOf",
                "values": soid
            });

            let res = search.create({
                type: 'customrecord_ntx_so_finance',
                filters: filters,
                columns: ['custrecord_ntx_so_finance_so']
            }).run().getRange(0, 1);
            if (res && res.length > 0) {
                return true;
            }
            return false;
        }


        function loadconfig(obj_soItems, arrParent, arrChild) {
            try {
                const SEARCH_CHILD_TBL = _script_obj.getParameter({
                    name: 'custscript_ntx_search_child_table1'
                });
                var obj_parentChild = createParentChild(obj_soItems, arrParent, arrChild);
                //log.debug('obj_parentChild: ', obj_parentChild); //Temp Log

                var soItems = [];
                var obj_config = {};
                var s_linenum = Object.keys(obj_soItems);

                for (var p = 0; p < s_linenum.length; p++) { //sales order items
                    var line_number = s_linenum[p];
                    soItems.push(obj_soItems[line_number]["itemid"]);
                }

                var searchObj2 = search.load({
                    id: SEARCH_CHILD_TBL
                });
                var additionalFilters = createFilterString(obj_parentChild);
                searchObj2.filterExpression = additionalFilters;

                var _searchObj2 = search.create({
                    type: searchObj2.searchType,
                    columns: searchObj2.columns,
                    filters: searchObj2.filters
                });

                var resultSet2 = _searchObj2.run();
                var result2 = resultSet2.getRange({
                    start: 0,
                    end: 1000
                });

                for (var ii = 0; result2 && ii < result2.length; ii++) {
                    var _parentId = result2[ii].getValue({
                        name: "custrecord_ntx_ms_config_parent_item",
                        join: "custrecord_ntx_ms_config_ct_parent_item"
                    });
                    var _parentName = result2[ii].getValue({
                        name: "name",
                        join: "custrecord_ntx_ms_config_ct_parent_item"
                    });
                    var _childId = result2[ii].getValue("custrecord_ntx_ms_config_ct_child_item");
                    var _group = result2[ii].getValue("custrecord_ntx_ms_config_ct_group");
                    var _base = result2[ii].getValue("custrecord_ntx_ms_config_ct_base");

                    var _hyp = result2[ii].getValue("custrecord_ntx_ms_config_ct_hyp");
                    var _adjust = result2[ii].getValue("custrecord_ntx_ms_config_ct_adjust");
                    var _msName = result2[ii].getValue("custrecord_ntx_ms_config_ct_msname");
                    var _servCat = result2[ii].getValue("custrecord_ntx_ms_config_ct_serv_cat");
                    var _proposedUseCase = result2[ii].getValue("custrecord_ntx_ms_config_ct_prop_usecase");
                    var _secondaryType = result2[ii].getValue("custrecord_ntx_ms_config_ct_sec_type");
                    var _useCaseDescription = result2[ii].getValue("custrecord_ntx_ms_config_ct_usecase_desc");
                    var _nonBillable = result2[ii].getValue("custrecord_ntx_ms_config_ct_non_billable");

                    var _fixedDeliverable = result2[ii].getValue("custrecord_ntx_ms_config_ct_fixed_del");
                    var _salePrice = result2[ii].getValue("custrecord_ntx_ms_config_ct_sales_price");
                    var _msPerQuan = result2[ii].getValue({
                        name: "custrecord_ntx_ms_config_ms_per_quan",
                        join: "custrecord_ntx_ms_config_ct_parent_item"
                    });
                    var _childInternalId = result2[ii].id;
                    var _appendChild = result2[ii].getValue({
                        name: "custrecord_ntx_ms_config_append_children",
                        join: "custrecord_ntx_ms_config_ct_parent_item"
                    });
                    var _isFlex = result2[ii].getValue({
                        name: "custrecord_ntx_ms_config_flex_item",
                        join: "custrecord_ntx_ms_config_ct_parent_item"
                    });

                    var __childId = ii + "_" + _childId;
                    obj_config[__childId] = {};
                    obj_config[__childId]["_parentId"] = _parentId;

                    obj_config[__childId]["_parentName"] = _parentName;
                    obj_config[__childId]["_childId"] = _childId;
                    obj_config[__childId]["_group"] = _group;
                    obj_config[__childId]["_base"] = _base;
                    obj_config[__childId]["_hyp"] = _hyp;
                    obj_config[__childId]["_adjust"] = _adjust;
                    obj_config[__childId]["_msName"] = _msName;
                    obj_config[__childId]["_servCat"] = _servCat;
                    obj_config[__childId]["_proposedUseCase"] = _proposedUseCase;
                    obj_config[__childId]["_secondaryType"] = _secondaryType;
                    obj_config[__childId]["_useCaseDescription"] = _useCaseDescription;
                    obj_config[__childId]["_nonBillable"] = _nonBillable;
                    obj_config[__childId]["_fixedDeliverable"] = _fixedDeliverable;
                    obj_config[__childId]["_salePrice"] = _salePrice;
                    obj_config[__childId]["_msPerQuan"] = _msPerQuan;
                    obj_config[__childId]["_childInternalId"] = _childInternalId;
                    obj_config[__childId]["_appendChild"] = _appendChild;
                    obj_config[__childId]["_isFlex"] = _isFlex;
                    obj_config[__childId]["_sfId"] = getSfId(_parentId, _childId, obj_parentChild);
                }
            } catch (e) {
                log.error('in loadconfig', e);
            } finally {
                return obj_config;
            }

        }
        //create object where data for  milestones to be created are stored in object
        function getMSConfig(obj_soItems, objSoItemToCreateProject) {
            var arrParent = objSoItemToCreateProject.parent;
            var arrChild = objSoItemToCreateProject.child;
            try {
                var new_so_obj = {};
                var obj_config = loadconfig(obj_soItems, arrParent, arrChild);

                var c_parentNames = Object.keys(obj_config);
                var s_linenum = Object.keys(obj_soItems);

                var _num = 0;
                var LineIdMsName = {};
                for (var p = 0; p < s_linenum.length; p++) { //sales order items
                    var line_number = s_linenum[p];
                    var soItemId = obj_soItems[line_number]["itemid"];
                    var so_sf_line = obj_soItems[line_number]["sf_line"]
                    var so_sf_req = obj_soItems[line_number]["sf_req"];
                    var _soItemId = "_" + soItemId;
                    var obj_config_soItem = obj_config[_soItemId];
                    var temp_obj_config = obj_config;

                    for (var k = 0; k < c_parentNames.length; k++) {

                        var _config_childId = temp_obj_config[c_parentNames[k]]["_childId"];
                        var _config_parentId = temp_obj_config[c_parentNames[k]]["_parentId"];
                        var _config_appendChild = temp_obj_config[c_parentNames[k]]["_appendChild"];
                        var _config_arr_sf_id = temp_obj_config[c_parentNames[k]]["_sfId"];
                        var childBelongs = false;

                        if ((_config_childId == soItemId && (_config_appendChild == true || _config_appendChild == 'T')) ||
                            ((_config_parentId == _config_childId) && (_config_childId == soItemId) && (_config_appendChild == false || _config_appendChild == 'F')) ||
                            (_config_appendChild == false || _config_appendChild == 'F') && ((soItemId == _config_parentId && !so_sf_req && _config_arr_sf_id.indexOf(so_sf_line) > -1) || (soItemId == _config_parentId && !so_sf_req && !so_sf_line) ||
                                (soItemId == _config_childId && soItemId != _config_parentId && _config_arr_sf_id.indexOf(so_sf_req) > -1))) {
                            //last one for letting parent & child inside for cns-res
                            new_so_obj["_" + _num] = {}; //obj_soItems[line_number];
                            new_so_obj = transferValueToNewObj(obj_soItems[line_number], new_so_obj, "_" + _num);

                            new_so_obj["_" + _num]["_parentId"] = temp_obj_config[c_parentNames[k]]["_parentId"];
                            new_so_obj["_" + _num]["_parentName"] = temp_obj_config[c_parentNames[k]]["_parentName"];
                            new_so_obj["_" + _num]["_childId"] = temp_obj_config[c_parentNames[k]]["_childId"];
                            new_so_obj["_" + _num]["_group"] = temp_obj_config[c_parentNames[k]]["_group"];
                            new_so_obj["_" + _num]["_base"] = temp_obj_config[c_parentNames[k]]["_base"];
                            new_so_obj["_" + _num]["_hyp"] = temp_obj_config[c_parentNames[k]]["_hyp"];
                            new_so_obj["_" + _num]["_adjust"] = temp_obj_config[c_parentNames[k]]["_adjust"];
                            new_so_obj["_" + _num]["_msName"] = temp_obj_config[c_parentNames[k]]["_msName"];

                            new_so_obj["_" + _num]["_servCat"] = temp_obj_config[c_parentNames[k]]["_servCat"];
                            new_so_obj["_" + _num]["_proposedUseCase"] = temp_obj_config[c_parentNames[k]]["_proposedUseCase"];
                            new_so_obj["_" + _num]["_secondaryType"] = temp_obj_config[c_parentNames[k]]["_secondaryType"];
                            new_so_obj["_" + _num]["_useCaseDescription"] = temp_obj_config[c_parentNames[k]]["_useCaseDescription"];
                            new_so_obj["_" + _num]["_nonBillable"] = temp_obj_config[c_parentNames[k]]["_nonBillable"];
                            new_so_obj["_" + _num]["_fixedDeliverable"] = temp_obj_config[c_parentNames[k]]["_fixedDeliverable"];
                            new_so_obj["_" + _num]["_salePrice"] = temp_obj_config[c_parentNames[k]]["_salePrice"];
                            new_so_obj["_" + _num]["_msPerQuan"] = temp_obj_config[c_parentNames[k]]["_msPerQuan"];
                            new_so_obj["_" + _num]["_childInternalId"] = temp_obj_config[c_parentNames[k]]["_childInternalId"];
                            new_so_obj["_" + _num]["_appendChild"] = temp_obj_config[c_parentNames[k]]["_appendChild"];
                            new_so_obj["_" + _num]["_isFlex"] = temp_obj_config[c_parentNames[k]]["_isFlex"];
                            //  new_so_obj["_" + _num]["_global_list_price"] = temp_obj_config[c_parentNames[k]]["global_list_price"];

                            LineIdMsName[line_number] = {};
                            LineIdMsName[line_number]['msname'] = temp_obj_config[c_parentNames[k]]["_msName"];
                            LineIdMsName[line_number]['_num'] = "_" + _num.toString();

                            _num = _num + 1;
                            if (_config_appendChild == 'T' || _config_appendChild == true)
                                break;
                        }
                    }

                }
                ///end store parent items and respective quan & amount
                //log.debug("before loop", JSON.stringify(new_so_obj));
                /*   log.debug('new_so_obj a', JSON.stringify(new_so_obj));
                   log.debug('obj_soItems b', JSON.stringify(obj_soItems));*/
                var new_s_linenum = Object.keys(new_so_obj);
                var sf_total = {};
                var sh = 0;
                for (var a = 0; a < new_s_linenum.length; a++) {
                    /* log.debug('a::' + a, JSON.stringify(new_so_obj));*/

                    var ggg = new_so_obj[new_s_linenum[a]];
                    if (new_so_obj[new_s_linenum[a]] == undefined) //delete object's inside this would need this
                    {
                        continue;
                    }
                    var config_totalamount = new_so_obj[new_s_linenum[a]]["amount"];
                    /*  log.debug('config_totalamount a', config_totalamount);*/
                    var config_quantity = new_so_obj[new_s_linenum[a]]["quantity"];
                    var ms_per_quan = new_so_obj[new_s_linenum[a]]["_msPerQuan"];
                    var totalamount = '';
                    if (ms_per_quan == 'T' || ms_per_quan == true)
                        totalamount = pnvl(config_totalamount);
                    else
                        totalamount = pnvl(config_totalamount) * pnvl(config_quantity);
                    /*   log.debug('totalamount:a' + a, totalamount)*/
                    var _appendChild = new_so_obj[new_s_linenum[a]]["_appendChild"];
                    var _parentId = new_so_obj[new_s_linenum[a]]["_parentId"];
                    var msname = '';
                    var config_itemid = new_so_obj[new_s_linenum[a]]["itemid"];
                    var parent_sf_line = new_so_obj[new_s_linenum[a]]['sf_line'];
                    var parent_sf_req = new_so_obj[new_s_linenum[a]]['sf_req'];
                    if (new_so_obj[new_s_linenum[a]]["_msName"])
                        msname = new_so_obj[new_s_linenum[a]]["_msName"];
                    /* else if(!new_so_obj[new_s_linenum[a]]["_msName"] && config_itemid=='143607'&& _parentId =='143596' && !parent_sf_req){
                         //special case where cns-base comes seperately apart from cns-inst
                         msname =new_so_obj[new_s_linenum[a]]["itemname"];
                         totalamount=new_so_obj[new_s_linenum[a]]["amount"];
                         }*/
                    var msperQuan = new_so_obj[new_s_linenum[a]]["_msPerQuan"];

                    var config_childId = new_so_obj[new_s_linenum[a]]["_childId"];
                    var _isFlex = new_so_obj[new_s_linenum[a]]["_isFlex"];
                    if (config_itemid == _parentId)
                        sf_total = {}; //empty this why?-to handle two sets parent of same kind of items with different sf ids

                    var linenum = new_so_obj[new_s_linenum[a]]['linenum'];
                    var deleted_childIds = [];
                    var deleted_childIds_quan = [];
                    var child_sf_req = '';
                    var child_sf_line = '';
                    /*   log.debug('new_so_obj 2 a', JSON.stringify(new_so_obj)); //
                       log.debug('new_so_obj 123 a', arrChild.toString() + " " + arrParent.toString()) //737492 745457*/
                    for (var b = 0; b < s_linenum.length; b++) { //soitem, when parent has amt, child is 0

                        var _lineNumber = s_linenum[b];
                        child_sf_req = obj_soItems[s_linenum[b]]['sf_req'];
                        child_sf_line = obj_soItems[s_linenum[b]]['sf_line'];
                        var _childId = obj_soItems[s_linenum[b]]["itemid"]; //itemname

                        var _salePrice = obj_soItems[s_linenum[b]]["_salePrice"];
                        /*  log.debug('new_so_obj test45 ::' + b, 'child_sf_req:' + child_sf_req + ":parent_sf_line: " + parent_sf_line + ":_childId:" + _childId);*/
                        //child_sf_req::                 parent_sf_line: aDl2i000000ClykCAC:_childId:745457
                        if ((child_sf_req == parent_sf_line && (arrChild.indexOf(_childId) > -1 && arrParent.indexOf(_childId) == -1))) { //to include parent amt
                            //((b_sf_line && (!b_sf_req) &&(a_sf_line==b_sf_line) && (a_itemid ==b_itemid))
                            //((child_sf_line) && (!child_sf_req) && (parent_sf_line ==child_sf_line ) &&(_childId ==config_itemid))
                            //resolve same item in same parent but create diff line
                            /*    log.debug('new_so_obj inside b::' + b, obj_soItems[s_linenum[b]]["itemname"]); //1
                                log.debug('totalamount:b' + b, totalamount);*/
                            var __childamt = obj_soItems[s_linenum[b]]["amount"];
                            var quantity = obj_soItems[s_linenum[b]]["quantity"];

                            var _childamt = '';
                            if (ms_per_quan == 'T' || ms_per_quan == true) _childamt = pnvl(__childamt);
                            else
                                _childamt = pnvl(__childamt) * pnvl(quantity);

                            totalamount = pnvl(totalamount, true) + pnvl(_childamt, true);
                            /*  log.debug('totalamount post else', totalamount);*/

                            sh = totalamount; //980

                            if (sf_total[child_sf_req] == undefined) sf_total[child_sf_req] = 0;

                            sf_total[child_sf_req] = sh;

                            new_so_obj[new_s_linenum[a]]["totalamount"] = sf_total[child_sf_req];

                            if (_appendChild == 'T' || _appendChild == true) {

                                var _childname = LineIdMsName[_lineNumber]['msname']; //0,,1,2,3
                                msname = msname + _childname;
                                if (_childId != _parentId && arrParent.indexOf(_childId) == -1) { //delete child line that is not same as parent

                                    log.debug('delete child line that is not same as parent', _childId);

                                    var __num = LineIdMsName[_lineNumber]['_num'];
                                    deleted_childIds.push(_childId);
                                    deleted_childIds_quan.push(quantity);
                                    delete new_so_obj[__num];

                                }

                            } else {

                                if (config_itemid == _parentId && config_itemid != config_childId) {

                                    var __num = LineIdMsName["_" + linenum]['_num'];
                                    deleted_childIds.push(_childId);
                                    deleted_childIds_quan.push(quantity);
                                    delete new_so_obj[__num];


                                }

                                break;


                            }
                        }
                    }
                    /*  log.debug('new_so_obj 3', JSON.stringify(new_so_obj));*/
                    //log.debug('before cleaning up', JSON.stringify(new_so_obj));
                    if (new_so_obj[new_s_linenum[a]] != undefined) {

                        new_so_obj[new_s_linenum[a]]['removed_childIds'] = deleted_childIds;
                        new_so_obj[new_s_linenum[a]]['removed_childIds_quan'] = deleted_childIds_quan;
                        if (child_sf_req == parent_sf_req && sf_total[child_sf_req] != undefined) {
                            totalamount = sf_total[child_sf_req];

                        } else {
                            //when two types of cns-res /parent child items come next to next, this needed to fetch total amt based on sf req, 1 item wont create problem
                            /* var sf_req =new_so_obj[new_s_linenum[a]]["sf_req"]; //2.1
                             if(!sf_req)*/
                            var msperQuan = new_so_obj[new_s_linenum[a]]["_msPerQuan"];
                            var sf_line = new_so_obj[new_s_linenum[a]]["sf_req"]; //2.1
                            var actual_sf_line = new_so_obj[new_s_linenum[a]]["sf_line"];
                            if (!sf_line) sf_line = actual_sf_line; //new_so_obj[new_s_linenum[a]]["sf_line"];
                            if (msperQuan == 'F' || msperQuan == false) {
                                totalamount = (SF_REQ_AMT[sf_line] ? SF_REQ_AMT[sf_line] : SF_REQ_AMT[actual_sf_line]); //2.3
                            } else if (totalamount == 0) { //cns-res and its child comes is in 2nd and 3rd line, and other ms skus exist next, amt becomes0, this fix below sorts it
                                totalamount = (SF_REQ_UP[sf_line] ? SF_REQ_UP[sf_line] : SF_REQ_UP[actual_sf_line]);
                            }

                        }
                        new_so_obj[new_s_linenum[a]]["totalamount"] = totalamount;
                        new_so_obj[new_s_linenum[a]]["ms_name"] = msname; //.replace(/^\/|\/$/g, '');
                    }
                    /*    log.debug('new_so_obj 4', JSON.stringify(new_so_obj));*/
                    //log.debug('end of loop ', JSON.stringify(new_so_obj));

                }
                // log.debug(' new_so_obj before ', JSON.stringify(new_so_obj));
                //     new_so_obj = ManageFlexSkus(new_so_obj);
                /*  log.debug('new_so_obj 5', JSON.stringify(new_so_obj));*/
                return new_so_obj;

            } catch (e) {
                log.error('in getMSConfig', e);
            } finally {
                return new_so_obj;
            }

        }

        function ManageFlexSkus(new_so_obj) {
            //return new_so_obj;
            var s_linenum = Object.keys(new_so_obj);
            var flexFilled = false;
            var totalamt = 0;
            var totalquan = 0;
            var p_line_number = '';
            return new_so_obj;
            for (var p = 0; p < s_linenum.length; p++) { //sales order items
                var line_number = s_linenum[p];

                var _isFlex = new_so_obj[line_number]["_isFlex"];
                if (_isFlex == 'T' || _isFlex == true) {
                    if (!p_line_number) {
                        p_line_number = line_number;
                        new_so_obj[p_line_number]["totalamount"] = 0;
                    }
                    var _amt = new_so_obj[line_number]["amount"];

                    var quantity = new_so_obj[line_number]["quantity"];

                    totalquan = pnvl(quantity, true) + pnvl(totalquan, true);

                    totalamt = pnvl(_amt, true) * pnvl(quantity, true);
                    new_so_obj[p_line_number]["totalamount"] = totalamt + pnvl(new_so_obj[p_line_number]["totalamount"], true);
                    new_so_obj[p_line_number]["quantity"] = totalquan;

                    new_so_obj[p_line_number]["amount"] = pnvl(new_so_obj[p_line_number]["totalamount"], true) / pnvl(new_so_obj[p_line_number]["quantity"], true);



                    if (flexFilled)
                        delete new_so_obj[line_number];


                    flexFilled = true;

                }

            }
            return new_so_obj;
        }

        function removeDuplicates(arr) {
            var unique_array = []
            for (var i = 0; i < arr.length; i++) {
                if (unique_array.indexOf(arr[i]) == -1 && arr[i]) {
                    unique_array.push(arr[i])
                }
            }
            return unique_array;
        }

        function pnvl(value, number) {
            if (number) {
                if (isNaN(parseFloat(value))) return 0;
                return parseFloat(value);
            }
            if (value == null) return '';
            return value;
        }

        function onlyUnique(value, index, self) {
            return self.indexOf(value) === index;
        }

        function getRelatedAtRiskSOF(uniqueOptyId) {

            var atRiskSOFId = null;
            var so_financeSearchObj = search.create({
                type: "customrecord_ntx_so_finance",
                filters: [
                    ["isinactive", "is", "F"],
                    "AND",
                    [
                        ["name", "is", uniqueOptyId], "OR", ["custrecord_ntx_sof_unique_opty_id", "is", uniqueOptyId]
                    ]
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
                    })
                ]
            });

            var sofResultSet = so_financeSearchObj.run();

            var sofResults = sofResultSet.getRange({
                start: 0,
                end: 1
            });

            if (sofResults[0] != null && sofResults[0] != "")
                atRiskSOFId = sofResults[0].getValue('internalid');

            return atRiskSOFId;

        }

        function getAtRiskSOFItemInfo(atRiskSOFId) {
            var sofItemDetailsObj = {};
            var ntx_so_flex_allocationSearchObj = search.create({
                type: "customrecord_ntx_so_flex_allocation",
                filters: [
                    ["custrecord_ntx_so_flex_alloc_fin_detail.custrecord_ntx_so_fin_dts_header", "anyof", atRiskSOFId],
                    "AND",
                    ["custrecord_ntx_so_flex_alloc_fin_detail.isinactive", "is", "F"],
                    "AND",
                    ["custrecord_ntx_so_flex_alloc_fin_rel_ms.custevent_ntx_sl_parent_ms", "anyof", "@NONE@"]
                ],
                columns: [
                    search.createColumn({
                        name: "custrecord_ntx_so_flex_alloc_fin_detail",
                        sort: search.Sort.ASC,
                        label: "SO Finance Detail"
                    }),
                    search.createColumn({
                        name: "custrecord_ntx_so_fin_dts_do",
                        join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                        label: "Delivery Order"
                    }),
                    search.createColumn({
                        name: "custrecord_ntx_sofd_rel_at_risk_ms_id",
                        join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                        label: "Related Milestone Id"
                    }),
                    search.createColumn({
                        name: "custrecord_ntx_so_fin_dts_item",
                        join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                        label: "Item"
                    }),
                    search.createColumn({
                        name: "custrecord_ntx_so_fin_dts_quantity",
                        join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                        label: "Parent Flex quantity"
                    }),
                    search.createColumn({
                        name: "custrecordntx_sofd_ms_con_parent_id",
                        join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                        label: "MS Config Parent Id"
                    }),
                    search.createColumn({
                        name: "custrecord_ntx_sofd_ms_con_child_id",
                        join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                        label: "MS Config Child Id"
                    }),
                    search.createColumn({
                        name: "custrecord_ntx_sofd_at_rsik_child_item",
                        join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                        label: "MS Config  - Child Item "
                    }),
                    search.createColumn({
                        name: "custrecord_ntx_sofd_shadow_revenue",
                        join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                        label: "Shadow Revenue"
                    })
                ]
            });
            var searchResultCount = ntx_so_flex_allocationSearchObj.runPaged().count;
            log.debug("sofDetailCount: ", searchResultCount);

            var index = 0;
            ntx_so_flex_allocationSearchObj.run().each(function(result) {

                var soFinanceDetailId = result.getValue('custrecord_ntx_so_flex_alloc_fin_detail');
                var sofItem = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_item",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    label: "Item"
                });
                var sofItemQty = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_quantity",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    label: "Parent Flex quantity"
                });
                var deliveryOrderId = result.getValue({
                    name: "custrecord_ntx_so_fin_dts_do",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    label: "Delivery Order"
                });
                var atRiskMilestoneId = result.getValue({
                    name: "custrecord_ntx_sofd_rel_at_risk_ms_id",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    label: "Related Milestone Id"
                });
                var parentConfiId = result.getValue({
                    name: "custrecordntx_sofd_ms_con_parent_id",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    label: "MS Config Parent Id"
                });
                var childConfigId = result.getValue({
                    name: "custrecord_ntx_sofd_ms_con_child_id",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    label: "MS Config Child Id"
                });
                var childItemId = result.getValue({
                    name: "custrecord_ntx_sofd_at_rsik_child_item",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    label: "MS Config  - Child Item "
                });
                var shadowRevenueAmt = result.getValue({
                    name: "custrecord_ntx_sofd_shadow_revenue",
                    join: "CUSTRECORD_NTX_SO_FLEX_ALLOC_FIN_DETAIL",
                    label: "Shadow Revenue"
                });

                sofItemDetailsObj['_' + index] = {};
                sofItemDetailsObj['_' + index]["ATRSOF_DETAIL_ID"] = soFinanceDetailId; //BA-89238
                sofItemDetailsObj['_' + index]["ATRSOF_PARENT_ITEM_ID"] = sofItem;
                sofItemDetailsObj['_' + index]["ATRSOF_CHILD_ITEM_ID"] = childItemId;
                sofItemDetailsObj['_' + index]["ATRSOF_QUANTITY"] = sofItemQty;
                sofItemDetailsObj['_' + index]["ATRSOF_DO_ID"] = deliveryOrderId;
                sofItemDetailsObj['_' + index]["ATRSOF_MILESTONE_ID"] = atRiskMilestoneId;
                sofItemDetailsObj['_' + index]["ATRSOF_MS_PARENT_CONFIG_ID"] = parentConfiId;
                sofItemDetailsObj['_' + index]["ATRSOF_MS_CHILD_CONFIG_ID"] = childConfigId;
                sofItemDetailsObj['_' + index]["ATRSOF_MS_AMOUNT"] = shadowRevenueAmt;
                sofItemDetailsObj['_' + index]["ACTUAL_MS_AMOUNT"] = 0;
                sofItemDetailsObj['_' + index]["ACTUAL_SALES_PERCENTAGE"] = 0;
                sofItemDetailsObj['_' + index]["IS_ITEM_AND_QUANTITY_MATCH"] = 'F';

                index = index + 1;

                return true;
            });

            return sofItemDetailsObj;
        }

        function getUniqueIdsNew(obj_toCreateMS) {
            var arr_ids = [];
            let arr_sf_req = [];
            let not_remove_arr_sf_req = [];
            for (var property in obj_toCreateMS) {
                var gg = obj_toCreateMS[property]['sf_line'];
                var jj = obj_toCreateMS[property]['sf_req'];
                arr_ids.push(obj_toCreateMS[property]['sf_line']);
                arr_ids.push(obj_toCreateMS[property]['sf_req']);
                if (obj_toCreateMS[property]['sf_line'] && obj_toCreateMS[property]['sf_req'])
                    arr_sf_req.push(obj_toCreateMS[property]['sf_req']);
                else
                    not_remove_arr_sf_req.push(obj_toCreateMS[property]['sf_line']);

                /*
                 * 1) for normal parent & child, remove parentsf_req
                 * 2) for cns-inst, child also comes along with parent as independant,
                 * parent only comes in this object, hence do not remomve sf_req of it.
                 * cns-inst, emea, base, afs, two ms needed, here it comes as cns-inst & afs, if we dont have above if condition, it removed cns-inst sf_req, hence it wont create ms for cns-inst
                 * 3) for normal parent & child, 	CNS-INF-A-WRK-MCR-STD	, standard documentation
                 * this object will have standard documentation's sf_req & sf_liine, henc eits important to remove sf_req as it creates empty project
                 * */

            }
            const __not_remove_arr_sf_req = new Set(not_remove_arr_sf_req);
            arr_sf_req = arr_sf_req.filter(x => !__not_remove_arr_sf_req.has(x));
            let uniqueIds = removeDuplicates(arr_ids);
            // const filteredArray = uniqueIds.filter(value => arr_sf_req.includes(value)); //a

            const toRemove = new Set(arr_sf_req);
            const difference = uniqueIds.filter(x => !toRemove.has(x));

            return difference; //difference;
        }


        function get_flex_ms_obj(new_so_obj) {
            let flexLines = [];
            for (var _p in new_so_obj) {
                if ((new_so_obj[_p]['_isFlex'] == 'T' || new_so_obj[_p]['_isFlex'] == true)) {
                    flexLines.push(new_so_obj[_p]);
                }
            }
            return flexLines;
        }

        function createSOFinanceHeader(soRec) {
            var sofId = null;
            var newSOF = record.create({
                type: 'customrecord_ntx_so_finance'
            });
            newSOF.setValue({
                fieldId: 'custrecord_ntx_so_finance_so',
                value: soRec.id
            });
            let __oppId = soRec.getValue({
                fieldId: "custbody9"
            });
            newSOF.setValue({
                fieldId: 'custrecord_ntx_so_finance_sf_oppty_id',
                value: __oppId
            });
            var expDate = format.parse({
                value: soRec.getValue('trandate'),
                type: format.Type.DATE
            });
            expDate.setMonth(expDate.getMonth() + 12);
            newSOF.setValue({
                fieldId: 'custrecord_ntx_so_finance_inv_exp_date',
                value: expDate
            });
            newSOF.setValue({
                fieldId: 'custrecord_ntx_so_finance_extn_exp_date',
                value: expDate
            });
            var endUserId = soRec.getValue({
                fieldId: "custbody21"
            });
            var endUserName = search.lookupFields({
                type: 'customer',
                id: endUserId,
                columns: ['companyname']
            }).companyname;
            var orderNum = soRec.getText({
                fieldId: "tranid"
            });
            newSOF.setValue({
                fieldId: 'name',
                value: orderNum + " " + endUserName
            });
            var resellerId = soRec.getValue('custbody17');
            if (resellerId) {
                newSOF.setValue({
                    fieldId: 'custrecord_ntx_so_finance_reseller_addr',
                    value: getAddress(resellerId)
                });
            }

            var distId = soRec.getValue('custbody19');
            if (distId) {
                newSOF.setValue({
                    fieldId: 'custrecord_ntx_so_finance_disti_address',
                    value: getAddress(distId)
                });
            }
            var contactName = soRec.getValue('custbody_ship_to_contact_name');
            var contactNameparts = contactName.split(" ");
            if (contactNameparts.length > 0) {
                newSOF.setValue({
                    fieldId: 'custrecord_ntx_so_finance_cus_first_name',
                    value: contactNameparts[0]
                });
            }
            if (contactNameparts.length > 1) {
                newSOF.setValue({
                    fieldId: 'custrecord_ntx_so_finance_cus_last_name',
                    value: contactNameparts[1]
                });
            }
            newSOF.setValue({
                fieldId: 'custrecord_ntx_sof_ready_for_boomi_upd',
                value: true
            });

            sofId = newSOF.save();

            if (sofId)
                log.debug('sof', sofId);

            return sofId;
        }


        function createParentChild(obj_soItems, arrParent, arrChild) {
            var parentChild = {};
            var storeParentSfLine = []; //2.3
            var sf_lineIds = Object.keys(obj_soItems);

            var filled = false;
            for (var p = 0; p < sf_lineIds.length; p++) { //sales order items
                var _parentTotal = 0;
                var _parentUP = 0;
                var line_number = sf_lineIds[p];
                var p_sf_line = obj_soItems[line_number]["sf_line"];
                var p_sf_req = obj_soItems[line_number]["sf_req"]; //null
                var parentId = obj_soItems[line_number]["itemid"]; //property.itemid;

                _parentTotal = pnvl(obj_soItems[line_number]["quantity"]) * pnvl(obj_soItems[line_number]["amount"]);
                _parentUP = pnvl(obj_soItems[line_number]["amount"]);
                var c_sf_lineIds = Object.keys(obj_soItems);

                for (var pp = 0; pp < c_sf_lineIds.length; pp++) { //sales order items
                    var c_line_number = c_sf_lineIds[pp];
                    var c_sf_line = obj_soItems[c_line_number]["sf_line"];
                    var c_sf_req = obj_soItems[c_line_number]["sf_req"]; //property.sf_req; //null
                    var childId = obj_soItems[c_line_number]["itemid"]; //property.itemid;
                    var quan = obj_soItems[c_line_number]["quantity"];
                    var amount = obj_soItems[c_line_number]["amount"];
                    var child_Total = 0;
                    var child_UP = 0;
                    /*
                        * special case where base comes alone, not with parent cns-inst
                       if( childId =='143607' && !c_sf_req && !filled){
                           filled=true;
                           SF_REQ_AMT[c_sf_line] = amount;
                           SF_REQ_UP[c_sf_line] = amount;
                           continue;
                       }*/
                    if (p_sf_line != c_sf_line) {
                        child_Total = pnvl(obj_soItems[c_line_number]["quantity"]) * pnvl(obj_soItems[c_line_number]["amount"]);
                        child_UP = pnvl(obj_soItems[c_line_number]["amount"]);
                    }
                    if ((p_sf_line == c_sf_req) || ((p_sf_line == c_sf_line) && (!p_sf_req && !c_sf_req)) ||
                        ((p_sf_line == c_sf_line) && (p_sf_req && c_sf_req) && (p_sf_req == c_sf_req) && (storeParentSfLine.indexOf(c_sf_req) == -1))) { //2.3

                        if ((arrParent.indexOf(childId) > -1) && (parentId != childId)) {

                            child_Total = child_UP = 0;
                        }
                        storeParentSfLine.push(p_sf_line); //2.3
                        _parentTotal = pnvl(_parentTotal, true) + pnvl(child_Total, true);
                        _parentUP = pnvl(_parentUP, true) + pnvl(child_UP, true);
                        parentChild[c_sf_line] = {};
                        parentChild[c_sf_line]['parent'] = parentId;
                        parentChild[c_sf_line]['child'] = childId;
                        parentChild[c_sf_line]['quantity'] = quan;
                        parentChild[c_sf_line]['c_sf_line'] = c_sf_line;
                        parentChild[c_sf_line]['c_sf_req'] = c_sf_req;
                        SF_REQ_AMT[p_sf_line] = _parentTotal;
                        SF_REQ_UP[p_sf_line] = _parentUP;
                    }

                }
            }


            return parentChild;
        }
        /*
         * create project record based on sales order values
         * */
        function createProjectFromSO(templateid, _soRecObj) {
            try {

                var newprojectrecord = record.create({
                    type: 'job',
                    isDynamic: true
                });

                var soid = _soRecObj.id;
                var sosubsidiary = _soRecObj.getValue('subsidiary');
                var salesrep = _soRecObj.getValue('custbody14');
                var soregion = _soRecObj.getValue('custbody_region'); //so region
                var soenduser = _soRecObj.getValue('custbody21'); //so end user

                var entity = _soRecObj.getValue('entity');

                var projectcompanyname = '';
                var tranid = _soRecObj.getValue('tranid'); //this will be the name of project
                var soendusertext = _soRecObj.getText('custbody21'); //so end user text
                projectcompanyname = tranid;
                if (soendusertext) {
                    projectcompanyname += ' ' + getEndUserName(soendusertext);
                    if (projectcompanyname && (projectcompanyname.length >= 82)) {
                        projectcompanyname = projectcompanyname.substring(0, 81); //v1.6
                    }
                }
                if (projectcompanyname && (projectcompanyname.length >= 82)) {
                    projectcompanyname = projectcompanyname.substring(0, 81); //v1.6
                }
                var random_num = "_" + Math.floor(Math.random() * 100000);
                var projTemplateRec = record.load({
                    type: 'projecttemplate',
                    id: templateid
                });


                var subsidiary = projTemplateRec.getValue('subsidiary');

                var startdate = projTemplateRec.getValue('startdate');
                var applyprojectexpensetypetoall = projTemplateRec.getValue('applyprojectexpensetypetoall');
                var jobbillingtype = projTemplateRec.getValue('jobbillingtype');
                var projectexpensetype = projTemplateRec.getValue('projectexpensetype');
                var billingschedule = projTemplateRec.getValue('billingschedule');
                var estimatedcost = projTemplateRec.getValue('estimatedcost');
                var estimatedrevenue = projTemplateRec.getValue('estimatedrevenue');
                var jobitem = projTemplateRec.getValue('jobitem');
                var estimatedcostjc = projTemplateRec.getValue('estimatedcostjc');
                var estimatedrevenuejc = projTemplateRec.getValue('estimatedrevenuejc');
                var estimatedgrossprofit = projTemplateRec.getValue('estimatedgrossprofit');
                var estimatedgrossprofitpercent = projTemplateRec.getValue('estimatedgrossprofitpercent');
                var allowtime = projTemplateRec.getValue('allowtime');
                var allowallresourcesfortasks = projTemplateRec.getValue('allowallresourcesfortasks');
                var limittimetoassignees = projTemplateRec.getValue('limittimetoassignees');
                var isutilizedtime = projTemplateRec.getValue('isutilizedtime');
                var isproductivetime = projTemplateRec.getValue('isproductivetime');
                var isexempttime = projTemplateRec.getValue('isexempttime');
                var allowexpenses = projTemplateRec.getValue('allowexpenses');
                var materializetime = projTemplateRec.getValue('materializetime');
                var includecrmtasksintotals = projTemplateRec.getValue('includecrmtasksintotals');
                var allowtasktimeforrsrcalloc = projTemplateRec.getValue('allowtasktimeforrsrcalloc');
                var useallocatedtimeforforecast = projTemplateRec.getValue('useallocatedtimeforforecast');

                //  newprojectrecord.setValue('custentity_ntx_related_so', soid);
                /* if(project_Minus_Te_Amount)
                     newprojectrecord.setValue('jobprice', project_Minus_Te_Amount);*/

                newprojectrecord.setValue('custentity_ntx_srp_so_num', tranid);
                newprojectrecord.setValue('companyname', projectcompanyname + random_num);
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
                newprojectrecord.setValue('externalid', soid + random_num);

                newprojectrecord.setValue('currency', _soRecObj.getValue('currency'));
                newprojectrecord.setValue('exchangerate', _soRecObj.getValue('exchangerate'));
                newprojectrecord.setValue('custentity_ntx_proj_create_date', dateFormat(new Date));

                if (soenduser)
                    setProjectUserDetails(soenduser, newprojectrecord);

                //============ for flex credit ========
                var nprojectid = newprojectrecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                return nprojectid;
            } catch (e) {
                log.error('Error in createProjectFromSO ' + soid, e);
                return '';
            }
        }

        function setProjectUserDetails(soenduser, newprojectrecord) {
            if (soenduser) {

                var serviceDeliveryLeaderId = null,
                    serviceDeliveryCoordinatorId = null;

                var crecordFieldLookup = search.lookupFields({
                    type: search.Type.CUSTOMER,
                    id: soenduser,
                    columns: ['custentity_assigned_consulting_mgr', 'custentity_ntx_service_delivery_coord']
                });

                if (crecordFieldLookup.custentity_assigned_consulting_mgr.length > 0 && crecordFieldLookup.custentity_assigned_consulting_mgr[0].value)
                    serviceDeliveryLeaderId = crecordFieldLookup.custentity_assigned_consulting_mgr[0].value;

                if (crecordFieldLookup.custentity_ntx_service_delivery_coord.length > 0 && crecordFieldLookup.custentity_ntx_service_delivery_coord[0].value)
                    serviceDeliveryCoordinatorId = crecordFieldLookup.custentity_ntx_service_delivery_coord[0].value;

                if (serviceDeliveryLeaderId)
                    newprojectrecord.setValue('custentity_assigned_consulting_mgr', serviceDeliveryLeaderId);

                if (serviceDeliveryCoordinatorId)
                    newprojectrecord.setValue('custentity_ntx_service_delivery_coord', serviceDeliveryCoordinatorId);


            }
        }


        function createMilestoneForProject(soid, obj_toCreateMS, nprojectid, sf_id, u_ids) {
            log.debug('obj_toCreateMS12', obj_toCreateMS);
            let UPPERLIMIT_QUANTITY = _script_obj.getParameter({
                name: 'custscript_ntx_upperlimit_quantity1'
            });

            var KEY_VALUE_MS = {
                "custevent_milestone_amount": "totalamount",
                "custevent_ntx_ms_serv_item": "_parentId",
                "custevent_service_category": "_servCat",
                "custevent_proposed_use_case": "_proposedUseCase",
                "custevent_secondary_type": "_secondaryType",
                "custevent_use_case_description": "_useCaseDescription",
                "nonbillabletask": "_nonBillable",
                "custevent_fixed_deliverable": "_fixedDeliverable",

                "title": "ms_name",
            }
            var rev_date = new Date(new Date().setFullYear(new Date().getFullYear() + 1));

            var currYearAndQtr = getCurrentQtrYear(rev_date);

            var currYear = getProjectYearId(currYearAndQtr.year);
            var currQtr = currYearAndQtr.quarter;

            var scriptObj1 = runtime.getCurrentScript();
            var template_non_flex = scriptObj1.getParameter({
                name: 'custscript_ntx_default_non_flex1'
            });
            var template_flex = scriptObj1.getParameter({
                name: 'custscript_ntx_default_flex1'
            });

            var obj_msId_childId = {};

            var msKeys = Object.keys(obj_toCreateMS);

            for (var hh = 0; hh < msKeys.length; hh++) { //start looping number of milestones to be created

                //loop number of milestone to be created per quantity
                var copyTemplate = template_non_flex;

                var _msObj = obj_toCreateMS[msKeys[hh]];

                var sf_line = _msObj['sf_line']
                var sf_req = _msObj['sf_req']
                if ((sf_id != sf_req && sf_id != sf_line) || (u_ids.indexOf(sf_req) > -1 && sf_id == sf_req)) {
                    continue;
                }
                var childId = _msObj['_childInternalId'];
                var isFlex = _msObj['_isFlex'];

                var _msPerQuan = _msObj['_msPerQuan'];


                var quantity = 1;
                if (pnvl(_msObj['quantity'], true) > pnvl(UPPERLIMIT_QUANTITY, true) && (_msPerQuan == 'T' || _msPerQuan == true)) {
                    quantity = UPPERLIMIT_QUANTITY;
                    _msObj['quantity'] = UPPERLIMIT_QUANTITY;

                }
                if (_msPerQuan == 'T' || _msPerQuan == true) quantity = _msObj['quantity'];

                var _arrNewMsId = [];

                if (isFlex == 'T' || isFlex == true) {
                    copyTemplate = template_flex;
                }

                log.debug('QUANTITY: ', quantity);

                for (var qq = 0; qq < quantity; qq++) {
                    try {
                        var _newMSRecord = record.copy({
                            type: 'projecttask',
                            id: copyTemplate,
                            isDynamic: true
                        });

                        _newMSRecord.setValue('company', nprojectid);
                        _newMSRecord.setValue('startdate', new Date());
                        _newMSRecord.setValue('custevent_ntx_do_related_so', soid);

                        if (isFlex == 'T' || isFlex == true) { //Need to check

                            //_msObj['totalamount'] = pnvl(_msObj['quantity'])* pnvl(_msObj['totalamount']);
                            _newMSRecord.setValue('custevent_ntx_flex_credit_allocated', _msObj['quantity']); //store credit only for flex item
                            var flxFld = ['custentity_total_credits_purchased', 'custentity_credits_balance', 'custentity_ntx_srp_flex_price_per_credit'];
                            let __amt = (_msObj['amount'] == 0 ? _msObj['totalamount'] : _msObj['amount']);
                            log.debug('__amt', __amt);

                            var flxVal = [_msObj['quantity'], _msObj['quantity'], __amt];

                            var id = record.submitFields({
                                type: record.Type.JOB,
                                id: nprojectid,
                                values: {
                                    flxFld: flxVal
                                },
                                options: {
                                    enableSourcing: false,
                                    ignoreMandatoryFields: true
                                }
                            });
                        }

                        for (var property in KEY_VALUE_MS) {
                            var _val = KEY_VALUE_MS[property];
                            if (_msObj.hasOwnProperty(_val)) {
                                //if (_msObj['totalamount'] == null) {
                                if (!_msObj['totalamount']) {
                                    //_msObj['totalamount'] =(_msObj['amount'] ==0 ? _msObj['totalamount']:_msObj['amount']);
                                    _msObj['totalamount'] = _msObj['amount'];
                                }
                                //below logic is for skus that comes alone when there is parent, this is mostly for inst skus
                                /* if(sf_line && sf_req){
                                	 _msObj['totalamount'] =_msObj['amount'];
                                 }*/

                                _msObj = processAmt(_msObj, sf_line, sf_req);

                                if (property == 'custevent_milestone_amount') {

                                    var ff = _msObj[_val];
                                    log.debug('__amt', ff);
                                    var newamt = calc_SalesPrice(_msObj['_salePrice'], _msObj[_val]);
                                    log.debug('shadow rev1', _msObj['global_list_price']);
                                    if (_msObj[_val] == 0 || !_msObj[_val]) {
                                        log.debug('shadow rev', _msObj['global_list_price']);
                                        // _msObj[_val] = _msObj['_global_list_price'];
                                        log.debug('setting global list price', _msObj['quantity'])
                                        _newMSRecord.setValue('custevent_shadow_rev_ms', _msObj['quantity']);
                                        _newMSRecord.setValue('custevent_milestone_amount', 0);
                                    } else {

                                        _newMSRecord.setValue(property, newamt);
                                    }
                                    //_newMSRecord.setValue('custevent_ntx_percentage_of_sku_revenue', parseFloat(_msObj['_salePrice']));
                                    continue;
                                }
                                if (_msObj[_val]) {
                                    /* if (property == 'custevent_service_category') {
                                         //_msObj[_val] = _msObj[_val].toString().split(',');

                                     }*/


                                    if (_msObj[_val] !== null && _msObj[_val] !== "" && _msObj[_val] !== undefined)
                                        _newMSRecord.setValue(property, _msObj[_val]);
                                }
                            }
                        }
                        _newMSRecord.setValue('custevent_ntx_sku_expiry_date', dateFormat(rev_date));
                        _newMSRecord.setValue('custevent_milestone_quarter', currQtr);
                        _newMSRecord.setValue('custevent_milestone_year', currYear);
                        _newMSRecord.setValue('custevent_ntx_revenue_date', dateFormat(rev_date));
                        _newMSRecord.setValue('custevent_ntx_percent_sku_rev', parseFloat(_msObj['_salePrice']));

                        if (_newMSRecord.getValue('title')) {

                            var _msId = _newMSRecord.save({
                                enableSourcing: true,
                                ignoreMandatoryFields: true
                            });

                            _arrNewMsId.push(_msId);

                        }
                        obj_msId_childId["_" + _msId] = {};

                        obj_msId_childId["_" + _msId]['quantity'] = _msObj['quantity'];
                        obj_msId_childId["_" + _msId]['linenum'] = _msObj['linenum'];
                        obj_msId_childId["_" + _msId]['childId'] = childId;
                        obj_msId_childId["_" + _msId]['parentId'] = _msObj['_parentId'];
                        obj_msId_childId["_" + _msId]['_appendChild'] = _msObj['_appendChild'];
                        obj_msId_childId["_" + _msId]["msid"] = _msId;
                        obj_msId_childId["_" + _msId]["itemid"] = _msObj['_childId'];;
                        obj_msId_childId["_" + _msId]["removed_childIds"] = _msObj['removed_childIds'];
                        obj_msId_childId["_" + _msId]["removed_childIds_quan"] = _msObj['removed_childIds_quan'];
                        obj_msId_childId["_" + _msId]["amount"] = _newMSRecord.getValue('custevent_milestone_amount');
                        obj_msId_childId["_" + _msId]["sf_line"] = _msObj['sf_line'];
                        obj_msId_childId["_" + _msId]["sf_req"] = _msObj['sf_req'];
                        obj_msId_childId["_" + _msId]["_salePrice"] = _msObj['_salePrice'];
                    } catch (e) {
                        log.error('err while creating project task' + nprojectid, e);
                    }
                }

            }
            return obj_msId_childId;

        }

        function processAmt(_msObj, sf_line, sf_req) {
            var amt = '';
            /***start of cns-res =msperquan =true, should take amount****/

            if (sf_line && sf_req && _msObj['_msPerQuan'] == true) {
                //example cns-inst having child coming alone
                //  _msObj['totalamount'] = _msObj['amount'];
                amt = _msObj['amount'];
            }
            /*end**/
            /***start of frame sku =msperquan =false, shouldnt take amount, it takes amt & quan****/
            else if (sf_line && sf_req && _msObj['_msPerQuan'] == false) {
                //_msObj['totalamount'] = _msObj['totalamount'];
                amt = _msObj['totalamount'];
            } /**********/
            else if (sf_line && sf_req && _msObj['ms_name'].toString().toLowerCase().indexOf('cns-inst-add') > -1) {
                // _msObj['totalamount'] =_msObj['amount'];
                amt = _msObj['amount'];
            }
            if (amt == 0 && _msObj['totalamount'] != 0) {
                amt = _msObj['totalamount'];
            }
            _msObj['totalamount'] = amt;
            return _msObj;
        }

        function atRiskProcessAmt(soKey, _msObj, sf_line, sf_req) {
            var amt = '';
            /***start of cns-res =msperquan =true, should take amount****/
            if (sf_line && sf_req && _msObj[soKey]['_msPerQuan'] == true) {
                //example cns-inst having child coming alone
                //  _msObj['totalamount'] = _msObj['amount'];
                amt = _msObj[soKey]['amount'];
            }
            /*end**/
            /***start of frame sku =msperquan =false, shouldnt take amount, it takes amt & quan****/
            else if (sf_line && sf_req && _msObj[soKey]['_msPerQuan'] == false) {
                //_msObj['totalamount'] = _msObj['totalamount'];
                amt = _msObj[soKey]['totalamount'];
            } /**********/
            else if (sf_line && sf_req && _msObj[soKey]['ms_name'].toString().toLowerCase().indexOf('cns-inst-add') > -1) {
                // _msObj['totalamount'] =_msObj['amount'];
                amt = _msObj[soKey]['amount'];
            }
            if (amt == 0 && _msObj['totalamount'] != 0) {
                amt = _msObj[soKey]['totalamount'];
            }

            return amt;
        }

        function getEndUserName(name) {
            var parts = name.split(" ");
            if (parts.length > 1) {
                return parts.slice(1).join(" ");
            } else {
                return name;
            }
        }


        function getCurrentQtrYear(dt) {

            //setting this value to save performance, update this when year & quarter value changes
            var QUARTER = {
                "Q1": "1",
                "Q2": "2",
                "Q3": "3",
                "Q4": "4"
            };

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
            dtQtrYear.quarter = QUARTER[quarter];
            dtQtrYear.year = yy;

            return dtQtrYear;
        }

        function getKeysFromObject(obj, key, flag) {
            var _arrChildIdClean = [];
            var arrChildId = Object.keys(obj);
            for (var gg = 0; gg < arrChildId.length; gg++) {
                if (obj[arrChildId[gg]]['_appendChild'] == flag)
                    _arrChildIdClean.push(obj[arrChildId[gg]][key]);
            }
            return _arrChildIdClean;
        }

        function getEstimateHourSearchRes(_arrChildIdClean, isItem) {
            let SEARCH_EST_HRS = _script_obj.getParameter({
                name: 'custscript_ntx_search_est_hours1'
            });

            var _searchObj5 = search.load({
                id: SEARCH_EST_HRS
            });

            var filters5 = _searchObj5.filters; //reference Search.filters object to a new variable

            if (isItem) {
                filters5.push(search.createFilter({
                    name: 'custrecord_ntx_ms_config_ct_child_item',
                    join: 'CUSTRECORD_NTX_MS_CONFIG_ET_CHILD',
                    operator: search.Operator.ANYOF,
                    values: _arrChildIdClean
                }));

                filters5.push(search.createFilter({
                    name: 'custrecord_ntx_ms_config_et_res_type',
                    join: null,
                    operator: search.Operator.NONEOF,
                    values: ["@NONE@"]
                }));

            } else {
                filters5.push(search.createFilter({
                    name: 'custrecord_ntx_ms_config_et_child',
                    join: null,
                    operator: search.Operator.ANYOF,
                    values: _arrChildIdClean
                }));

                filters5.push(search.createFilter({
                    name: 'custrecord_ntx_ms_config_et_res_type',
                    join: null,
                    operator: search.Operator.NONEOF,
                    values: ["@NONE@"]
                }));

            }

            return _searchObj5;
        }

        function calculate_effortHrs_fromFormula(_formulaEffortHrs, _adj, _base, _hyp, _qty, obj_msId_childId, msId, _resType) {
            try {

                if (_formulaEffortHrs.indexOf('{quantity}') > -1)
                    _formulaEffortHrs = _formulaEffortHrs.replace('{quantity}', _qty);
                if (_formulaEffortHrs.indexOf('{custrecord_ntx_ms_config_et_child.custrecord_ntx_ms_config_ct_base}') > -1)
                    _formulaEffortHrs = _formulaEffortHrs.replace('{custrecord_ntx_ms_config_et_child.custrecord_ntx_ms_config_ct_base}', _base);

                if (_formulaEffortHrs.indexOf('{custrecord_ntx_ms_config_et_child.custrecord_ntx_ms_config_ct_adjust}') > -1)
                    _formulaEffortHrs = _formulaEffortHrs.replace('{custrecord_ntx_ms_config_et_child.custrecord_ntx_ms_config_ct_adjust}', _adj);

                if (_formulaEffortHrs.indexOf('{custrecord_ntx_ms_config_et_child.custrecord_ntx_ms_config_ct_hyp}') > -1)
                    _formulaEffortHrs = _formulaEffortHrs.replace('{custrecord_ntx_ms_config_et_child.custrecord_ntx_ms_config_ct_hyp}', _hyp);


                //{estimatedhours.Consultant} *0.8
                if (_formulaEffortHrs.indexOf('{estimatedhours.') > -1) {


                    var resTypeInFormula = getResourceTypeinFormula(_formulaEffortHrs);

                    var newEffort = obj_msId_childId["_" + msId][resTypeInFormula];

                    _formulaEffortHrs = _formulaEffortHrs.replace('{estimatedhours.' + resTypeInFormula + "}", newEffort);
                }
                if (_formulaEffortHrs.indexOf('SUM(CNS-INST)') > -1) {
                    _formulaEffortHrs = customCnsInstallFormula(_formulaEffortHrs, obj_msId_childId, msId);

                }
                /*var dd = _formulaEffortHrs;
                var ggg = eval(_formulaEffortHrs);*/

                return eval(_formulaEffortHrs);
            } catch (e) {
                log.debug('debug', 'error in calculate_effortHrs_fromFormula', e);
                return '';
            }
        }

        function getResourceTypeinFormula(_formulaEffortHrs) {
            try {
                var resTypeInFormula = _formulaEffortHrs.replace('estimatedhours.', '');
                resTypeInFormula = resTypeInFormula.match(/[^{\}]+(?=})/g)[0];
                return resTypeInFormula;
            } catch (e) {
                log.debug('error in getResourceTypeinFormula', e);
            }
        }

        function customCnsInstallFormula(_formulaEffortHrs, obj_msId_childId, _msId) {
            var removed_childMsIds = obj_msId_childId["_" + _msId]["removed_childIds"];
            var removed_child_quan = obj_msId_childId["_" + _msId]["removed_childIds_quan"];
            var parent_quan = obj_msId_childId["_" + _msId]["quantity"];
            var parent_itemid = obj_msId_childId["_" + _msId]["itemid"];
            removed_childMsIds.push(parent_itemid);
            removed_child_quan.push(parent_quan);

            var finalHrs = 0;
            if (removed_childMsIds.length > 0) {

                var _searchObj5 = getEstimateHourSearchRes(removed_childMsIds, true);

                var myResultSet5 = _searchObj5.run();

                var results = myResultSet5.getRange({
                    start: 0,
                    end: 1000
                });

                for (var ii = 0; results && ii < results.length; ii++) {
                    var _formulaEffortHrs = results[ii].getValue("custrecord_ntx_ms_config_et_form_esthrs");

                    var _effortHrs = results[ii].getValue("custrecord_ntx_ms_config_et_esthrs");
                    var _costRate = results[ii].getValue("custrecord_ntx_ms_config_et_cost_rate");
                    var _resType = results[ii].getValue("custrecord_ntx_ms_config_et_res_type");
                    var _child = results[ii].getValue("custrecord_ntx_ms_config_et_child");
                    var childItemId = results[ii].getValue({
                        name: "custrecord_ntx_ms_config_ct_child_item",
                        join: 'CUSTRECORD_NTX_MS_CONFIG_ET_CHILD'
                    });

                    var _adj = results[ii].getValue({
                        name: "custrecord_ntx_ms_config_ct_adjust",
                        join: "CUSTRECORD_NTX_MS_CONFIG_ET_CHILD"
                    });
                    var _base = results[ii].getValue({
                        name: "custrecord_ntx_ms_config_ct_base",
                        join: "CUSTRECORD_NTX_MS_CONFIG_ET_CHILD"
                    });
                    var _hyp = results[ii].getValue({
                        name: "custrecord_ntx_ms_config_ct_hyp",
                        join: "CUSTRECORD_NTX_MS_CONFIG_ET_CHILD"
                    });
                    if (_formulaEffortHrs) {
                        var _index = removed_childMsIds.indexOf(childItemId);

                        _effortHrs = calculate_effortHrs_fromFormula(_formulaEffortHrs, _adj, _base, _hyp, removed_child_quan[_index]);
                    }
                    finalHrs = pnvl(finalHrs, true) + pnvl(_effortHrs, true);
                }
            }

            return finalHrs;
        }

        function createSOFDetail(sofid, proj_id, flex_ms_obj, HistoricalRecordFlag) {

            var sofDetailRecObj = record.create({
                type: 'customrecord_ntx_so_finance_details',
                isDynamic: true
            });

            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_do', proj_id);
            sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_header', sofid); // set milestone id

            if (HistoricalRecordFlag) {
                log.debug('HistoricalRecordFlag', HistoricalRecordFlag)
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_his_flag', HistoricalRecordFlag);

            }
            if (flex_ms_obj) {
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_sf_req_ord_lin', flex_ms_obj['sf_req']); // set milestone id
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_sf_ord_line_id', flex_ms_obj['sf_line']); // set milestone id
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_so_line_id', flex_ms_obj['linenum']); // set milestone id

                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_amount', flex_ms_obj['totalamount']);
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_item', flex_ms_obj['_parentId']);
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_quantity', flex_ms_obj['quantity']);
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_amount', flex_ms_obj['totalamount']);
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_flexunitprice', flex_ms_obj['amount']);
                sofDetailRecObj.setValue('custrecord_ntx_so_fin_dts_parentflex', true);
                updatesofHeader(flex_ms_obj['amount'], flex_ms_obj['quantity'], sofid);
                //_msObj['amount']
            }

            //  sofDetailRecObj.setFieldValue('custrecord_ntx_so_fin_dts_sf_ord_line_id', '');

            var sofDetailRecId = sofDetailRecObj.save({
                enableSourcing: true,
                ignoreMandatoryFields: true
            });

            return sofDetailRecId;
        }

        function createDoAllocation(obj_ms_Id, sofdetailId) {
            log.debug('createDoAllocation', JSON.stringify(obj_ms_Id) + "::" + sofdetailId);
            var totalamt = 0
            var quan = 1;
            var sf_req;
            var sf_line;
            var parentId = '';
            var salesPrice = '';
            var line = '';
            for (var _id in obj_ms_Id) {
                var msid = obj_ms_Id[_id]['msid'];

                totalamt += parseFloat(obj_ms_Id[_id]['amount']);
                quan = obj_ms_Id[_id]['quantity'];
                sf_line = obj_ms_Id[_id]['sf_line'];
                sf_req = obj_ms_Id[_id]['sf_req'];
                line = obj_ms_Id[_id]['linenum'];
                parentId = obj_ms_Id[_id]['parentId'];
                salesPrice = obj_ms_Id[_id]['_salePrice'];


                var doAllocationRecObj = record.create({
                    type: 'customrecord_ntx_so_flex_allocation',
                    isDynamic: true
                });

                doAllocationRecObj.setValue('custrecord_ntx_so_flex_alloc_fin_rel_ms', msid);
                doAllocationRecObj.setValue('custrecord_ntx_so_flex_alloc_fin_detail', sofdetailId); // set milestone id


                doAllocationRecObj.setValue('custrecord_ntx_so_fin_dts_item', parentId); //parentId
                doAllocationRecObj.setValue('custrecord_ntx_so_fin_dts_sf_ord_line_id', sf_line);
                doAllocationRecObj.setValue('custrecord_ntx_so_flex_alloc_perc_skurev', parseFloat(salesPrice));

                var doAllocRecId = doAllocationRecObj.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                if (doAllocRecId)
                    log.debug('doAllocRecId: ', doAllocRecId);

            }

            var sofDetailsRecId = record.submitFields({
                type: 'customrecord_ntx_so_finance_details',
                id: sofdetailId,
                values: {
                    custrecord_ntx_so_fin_dts_quantity: quan,
                    custrecord_ntx_so_fin_dts_amount: totalamt,
                    custrecord_ntx_so_fin_dts_item: parentId,
                    custrecord_ntx_so_fin_dts_sf_ord_line_id: sf_line,
                    custrecord_ntx_so_fin_dts_sf_req_ord_lin: sf_req,
                    custrecord_ntx_so_fin_dts_so_line_id: line
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            if (sofDetailsRecId)
                log.debug('SOF Detail record updated sucessfully: ', sofDetailsRecId);

        }

        function updatesofHeader(unitprice, totalpurchased, sofid) {
            try {

                var sofRecId = record.submitFields({
                    type: 'customrecord_ntx_so_finance',
                    id: sofid,
                    values: {
                        custrecord_ntx_so_finance_credits_balanc: totalpurchased,
                        custrecord_ntx_so_finance_credits_total: totalpurchased,
                        custrecord_ntx_so_finance_credits_price: unitprice
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            } catch (e) {
                log.error('updatesofheader', e);
            }
        }

        function calc_SalesPrice(perc, msAmount) {
            try {
                return (parseFloat(msAmount) * parseFloat(perc)) / 100
            } catch (e) {
                log.error('inside calc sales price', e);
                return 0;
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

        function toFixed(num) {
            if (num)
                return num.toFixed(2);
            else return 0;
        }

        function update_esthrs(obj_msId_childId) {
            var allMsIds = Object.keys(obj_msId_childId);
            log.debug('allMsIds', allMsIds.toString());
            var arr_ms_ids = allMsIds.map(function(x) {
                return x.replace(/_/g, "")
            });

            for (var kk = 0; kk < arr_ms_ids.length; kk++) {
                var id = arr_ms_ids[kk];
                try {

                    libestimatedhrs.CalEstEftProject(id, runtime.executionContext, true); //deepan to work on this

                } catch (e) {
                    log.error('calculate ms', e);
                }
            }
        }

        function getProjectYearId(project_year) {

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

            /*  var searchResultCount = project_yearSearchObj.runPaged().count;
              log.debug("searchResultCount: ", searchResultCount);*/

            project_yearSearchObj.run().each(function(result) {
                projectYearId = result.getValue('internalid');
                return true;
            });

            return projectYearId;
        }

        function getAddress(custId) {
            let addr = '';
            let customerSearchObj = search.create({
                type: "customer",
                filters: [
                    ["internalidnumber", "equalto", custId],
                    "AND",
                    ["isdefaultbilling", "is", "T"]
                ],
                columns: [
                    search.createColumn({
                        name: "address",
                        label: "Address"
                    })
                ]
            });
            //  var searchResultCount = customerSearchObj.runPaged().count;
            //log.debug("customerSearchObj result count",searchResultCount);
            customerSearchObj.run().each(function(result) {
                addr = result.getValue('address');

            });
            if (!addr)
                addr = search.lookupFields({
                    type: 'customer',
                    id: custId,
                    columns: ['address']
                }).address;
            return addr;
        }

        //******************************************* At Risk DO ********************************************************

        function getSuiteUIPageLink(screenCodeId, linkText, openInNewPage) {

            var _finalOutputURL = "";

            var _paramValue = new Object();
            _paramValue.custparam_screencode = screenCodeId;

            var suiteletOutputURL = url.resolveScript({
                scriptId: 'customscript_ntx_sl_create_at_risk_do_ui',
                deploymentId: 'customdeploy_ntx_sl_create_at_risk_do_ui',
                params: _paramValue
            });

            if (!openInNewPage)
                _finalOutputURL = "<a style='text-decoration: none; color: #0956b5' target='_self' href='" + suiteletOutputURL + "'>" + linkText + "</a>";
            else
                _finalOutputURL = "<a style='text-decoration: none; color: #0956b5' target='_blank' href='" + suiteletOutputURL + "'>" + linkText + "</a>";

            return _finalOutputURL;
        }

        function getRecordNavigationLink(record_Id, record_type, fieldName) {

            var finalOutputURL = "";

            if (record_Id && record_type && fieldName) {
                var fieldLookUp = search.lookupFields({
                    type: record_type,
                    id: record_Id,
                    columns: [fieldName]
                });

                //log.debug('fieldLookUp: ', fieldLookUp);

                var recordName = fieldLookUp[fieldName];

                // log.debug('recordName: ', recordName);

                var nsRecInternalURL = url.resolveRecord({
                    recordType: record_type,
                    recordId: record_Id,
                    isEditMode: false
                });

                finalOutputURL = "<a style='text-decoration: none; color: #0956b5' target='_blank' href='" + nsRecInternalURL + "'>" + recordName + "</a>";
            }

            return finalOutputURL;
        }

        function CreateEffortHrs(obj_msId_childId, msValue, results) {
            var RESOURCETYPE = getResourceType();
            var ms_ChildId = msValue['childId'];
            var msid = msValue['msid'];
            var _qty = msValue['quantity'];
            for (var ii = 0; results && ii < results.length; ii++) {
                try {
                    var _formulaEffortHrs = results[ii].getValue("custrecord_ntx_ms_config_et_form_esthrs");
                    var _effortHrs = results[ii].getValue("custrecord_ntx_ms_config_et_esthrs");
                    var _costRate = results[ii].getValue("custrecord_ntx_ms_config_et_cost_rate");
                    var _resType = results[ii].getValue("custrecord_ntx_ms_config_et_res_type");
                    var _child = results[ii].getValue("custrecord_ntx_ms_config_et_child");
                    var childItemId = results[ii].getValue({
                        name: "custrecord_ntx_ms_config_ct_child_item",
                        join: 'CUSTRECORD_NTX_MS_CONFIG_ET_CHILD'
                    });
                    var _adj = results[ii].getValue({
                        name: "custrecord_ntx_ms_config_ct_adjust",
                        join: "CUSTRECORD_NTX_MS_CONFIG_ET_CHILD"
                    });

                    var _base = results[ii].getValue({
                        name: "custrecord_ntx_ms_config_ct_base",
                        join: "CUSTRECORD_NTX_MS_CONFIG_ET_CHILD"
                    });
                    var _hyp = results[ii].getValue({
                        name: "custrecord_ntx_ms_config_ct_hyp",
                        join: "CUSTRECORD_NTX_MS_CONFIG_ET_CHILD"
                    });
                    if (ms_ChildId != _child) {
                        continue;
                    }

                    if (_formulaEffortHrs) {
                        _effortHrs = calculate_effortHrs_fromFormula(_formulaEffortHrs, _adj, _base, _hyp, _qty, obj_msId_childId, msid, _resType);
                        log.debug('_effortHrs', _effortHrs)
                        _effortHrs = toFixed(_effortHrs);
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
        }


        //******************************************* At Risk DO ********************************************************
        /************************************HISTORICAL RECORDS START************************/

        function createMilestoneForProject_1(soid, obj_toCreateMS, nprojectid, sf_id, u_ids) {
            let _msId = 0;
            let UPPERLIMIT_QUANTITY = _script_obj.getParameter({
                name: 'custscript_ntx_upperlimit_quantity1'
            });

            var KEY_VALUE_MS = {
                "custevent_ntx_ms_serv_item": "_parentId",
                "custevent_service_category": "_servCat",
                "custevent_proposed_use_case": "_proposedUseCase",
                "custevent_secondary_type": "_secondaryType",
                "custevent_use_case_description": "_useCaseDescription",
                "nonbillabletask": "_nonBillable",
                "custevent_fixed_deliverable": "_fixedDeliverable",
                "custevent_milestone_amount": "totalamount",
                "title": "ms_name",
            }
            var rev_date = new Date(new Date().setFullYear(new Date().getFullYear() + 1));

            var currYearAndQtr = getCurrentQtrYear(rev_date);

            var currYear = getProjectYearId(currYearAndQtr.year);
            var currQtr = currYearAndQtr.quarter;

            var scriptObj1 = runtime.getCurrentScript();
            var template_non_flex = scriptObj1.getParameter({
                name: 'custscript_ntx_default_non_flex1'
            });
            var template_flex = scriptObj1.getParameter({
                name: 'custscript_ntx_default_flex1'
            });

            var obj_msId_childId = {};

            var msKeys = Object.keys(obj_toCreateMS);

            for (var hh = 0; hh < msKeys.length; hh++) { //start looping number of milestones to be created

                //loop number of milestone to be created per quantity
                var copyTemplate = template_non_flex;

                var _msObj = obj_toCreateMS[msKeys[hh]];

                var sf_line = _msObj['sf_line']
                var sf_req = _msObj['sf_req']
                if ((sf_id != sf_req && sf_id != sf_line) || (u_ids.indexOf(sf_req) > -1 && sf_id == sf_req)) {
                    continue;
                }
                var childId = _msObj['_childInternalId'];
                var isFlex = _msObj['_isFlex'];

                var _msPerQuan = _msObj['_msPerQuan'];


                var quantity = 1;
                if (pnvl(_msObj['quantity'], true) > pnvl(UPPERLIMIT_QUANTITY, true) && (_msPerQuan == 'T' || _msPerQuan == true)) {
                    quantity = UPPERLIMIT_QUANTITY;
                    _msObj['quantity'] = UPPERLIMIT_QUANTITY;

                };
                if (_msPerQuan == 'T' || _msPerQuan == true) quantity = _msObj['quantity'];

                var _arrNewMsId = [];

                if (isFlex == 'T' || isFlex == true) {
                    copyTemplate = template_flex;
                }

                log.debug('QUANTITY: ', quantity);

                for (var qq = 0; qq < quantity; qq++) {
                    try {
                        /* var _newMSRecord = record.copy({
                                 type: 'projecttask',
                                 id: copyTemplate,
                                 isDynamic: true
                             });

                             _newMSRecord.setValue('company', nprojectid);
                             _newMSRecord.setValue('startdate', new Date());
                             _newMSRecord.setValue('custevent_ntx_do_related_so',soid);
*/
                        if (isFlex == 'T' || isFlex == true) { //Need to check

                            //_msObj['totalamount'] = pnvl(_msObj['quantity'])* pnvl(_msObj['totalamount']);
                            //    _newMSRecord.setValue('custevent_ntx_flex_credit_allocated', _msObj['quantity']); //store credit only for flex item
                            var flxFld = ['custentity_total_credits_purchased', 'custentity_credits_balance', 'custentity_ntx_srp_flex_price_per_credit']
                            var flxVal = [_msObj['quantity'], _msObj['quantity'], (_msObj['amount'] == 0 ? _msObj['totalamount'] : _msObj['amount'])];

                            /* var id = record.submitFields({
                                 type: record.Type.JOB,
                                 id: nprojectid,
                                 values: {
                                     flxFld: flxVal
                                 },
                                 options: {
                                     enableSourcing: false,
                                     ignoreMandatoryFields: true
                                 }
                             });*/
                        }
                        var newamt = 0;
                        for (var property in KEY_VALUE_MS) {
                            var _val = KEY_VALUE_MS[property];
                            if (_msObj.hasOwnProperty(_val)) {
                                if (!_msObj['totalamount']) {
                                    _msObj['totalamount'] = (_msObj['amount']);
                                }

                                //below logic is for skus that comes alone when there is parent, this is mostly for inst skus
                                /* if(sf_line && sf_req){
                                	 _msObj['totalamount'] =_msObj['amount'];
                                 }*/


                                /***start of cns-res =msperquan =true, should take amount***
                                 * no - for MS = No we should take the extended price (quantity x unit  price)
                                 *  */
                                if (sf_line && sf_req && _msObj['_msPerQuan'] != false) {
                                    _msObj['totalamount'] = _msObj['amount'];
                                }
                                /*end**/
                                /***start of frame sku =msperquan =false, shouldnt take amount, it takes amt & quan****/
                                if (sf_line && sf_req && _msObj['_msPerQuan'] == false) {
                                    _msObj['totalamount'] = _msObj['totalamount'];
                                } /**********/
                                if (sf_line && sf_req && _msObj['ms_name'].toString().toLowerCase().indexOf('cns-inst-add') > -1) {
                                    _msObj['totalamount'] = _msObj['amount'];
                                }
                                if (_msObj[_val]) {
                                    if (property == 'custevent_service_category') {
                                        //_msObj[_val] = _msObj[_val].toString().split(',');

                                    }
                                    if (property == 'custevent_milestone_amount') {
                                        var ff = _msObj[_val];

                                        newamt = calc_SalesPrice(_msObj['_salePrice'], _msObj[_val]);
                                        // _newMSRecord.setValue(property, newamt);
                                        continue;
                                    }

                                    if (_msObj[_val] !== null && _msObj[_val] !== "" && _msObj[_val] !== undefined) {
                                        // _newMSRecord.setValue(property, _msObj[_val]);
                                    }

                                }
                            }
                        }
                        /*  _newMSRecord.setValue('custevent_ntx_sku_expiry_date', dateFormat(rev_date));
                          _newMSRecord.setValue('custevent_milestone_quarter', currQtr);
                          _newMSRecord.setValue('custevent_milestone_year', currYear);
                          _newMSRecord.setValue('custevent_ntx_revenue_date', dateFormat(rev_date));

                          if (_newMSRecord.getValue('title')) {

                              var _msId = _newMSRecord.save({
                                  enableSourcing: true,
                                  ignoreMandatoryFields: true
                              });

                              _arrNewMsId.push(_msId);

                          }*/
                        obj_msId_childId["_" + _msId] = {};

                        obj_msId_childId["_" + _msId]['quantity'] = _msObj['quantity'];
                        obj_msId_childId["_" + _msId]['linenum'] = _msObj['linenum'];
                        obj_msId_childId["_" + _msId]['childId'] = childId;
                        obj_msId_childId["_" + _msId]['parentId'] = _msObj['_parentId'];
                        obj_msId_childId["_" + _msId]['_appendChild'] = _msObj['_appendChild'];
                        obj_msId_childId["_" + _msId]["msid"] = _msId;
                        obj_msId_childId["_" + _msId]["itemid"] = _msObj['_childId'];;
                        obj_msId_childId["_" + _msId]["removed_childIds"] = _msObj['removed_childIds'];
                        obj_msId_childId["_" + _msId]["removed_childIds_quan"] = _msObj['removed_childIds_quan'];
                        obj_msId_childId["_" + _msId]["amount"] = newamt;
                        obj_msId_childId["_" + _msId]["sf_line"] = _msObj['sf_line'];
                        obj_msId_childId["_" + _msId]["sf_req"] = _msObj['sf_req'];
                        obj_msId_childId["_" + _msId]["_salePrice"] = _msObj['_salePrice'];
                        _msId++;
                    } catch (e) {
                        log.error('err while creating project task_1', e);
                    }
                }

            }
            return obj_msId_childId;

        }

        function createDoAllocation_1(obj_ms_Id, sofdetailId) {
            log.debug('createDoAllocation', JSON.stringify(obj_ms_Id) + "::" + sofdetailId);
            var totalamt = 0
            var quan = 1;
            var sf_req;
            var sf_line;
            var parentId = '';
            var salesPrice = '';
            for (var _id in obj_ms_Id) {
                var msid = obj_ms_Id[_id]['msid'];

                totalamt += parseFloat(obj_ms_Id[_id]['amount']);
                quan = obj_ms_Id[_id]['quantity'];
                sf_line = obj_ms_Id[_id]['sf_line'];
                sf_req = obj_ms_Id[_id]['sf_req'];
                parentId = obj_ms_Id[_id]['parentId'];
                salesPrice = obj_ms_Id[_id]['_salePrice'];

                break;

            }

            var sofDetailsRecId = record.submitFields({
                type: 'customrecord_ntx_so_finance_details',
                id: sofdetailId,
                values: {
                    custrecord_ntx_so_fin_dts_quantity: quan,
                    custrecord_ntx_so_fin_dts_amount: totalamt,
                    custrecord_ntx_so_fin_dts_item: parentId,
                    custrecord_ntx_so_fin_dts_sf_ord_line_id: sf_line,
                    custrecord_ntx_so_fin_dts_sf_req_ord_lin: sf_req,
                    custrecord_ntx_so_flex_alloc_perc_skurev: salesPrice
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            if (sofDetailsRecId)
                log.debug('SOF Detail record updated sucessfully: ', sofDetailsRecId);

        }

        /*
         *
find respective project for the sof

create object out of the project
parentmsid
sku
ms amt
childms[]


create object out of sof
sofdetailid
sku
amount

start looping project
parentmsid
	loop sofid
		if(sofsku ==parentmsid){

submitsofdetail with delivery order,
create allocation record with msid,delivery order,msamt,msid,flexqty, status
remove this line from project parentmsid
}


         * */
        /********************************HISTORICAL RECORDS END************/

        return {
            getResourceType: getResourceType,
            createSOItemObject: createSOItemObject,
            soNeedProject: soNeedProject,
            filter_soItemObject: filter_soItemObject,
            createFilterString: createFilterString,
            transferValueToNewObj: transferValueToNewObj,
            removeDuplicates: removeDuplicates,
            pnvl: pnvl,
            onlyUnique: onlyUnique,
            getSfId: getSfId,
            ManageFlexSkus: ManageFlexSkus,
            getRelatedAtRiskSOF: getRelatedAtRiskSOF,
            getAtRiskSOFItemInfo: getAtRiskSOFItemInfo,
            getUniqueIdsNew: getUniqueIdsNew,
            get_flex_ms_obj: get_flex_ms_obj,
            createSOFinanceHeader: createSOFinanceHeader,
            createProjectFromSO: createProjectFromSO,
            createMilestoneForProject: createMilestoneForProject,
            getKeysFromObject: getKeysFromObject,
            getEstimateHourSearchRes: getEstimateHourSearchRes,
            calculate_effortHrs_fromFormula: calculate_effortHrs_fromFormula,
            getResourceTypeinFormula: getResourceTypeinFormula,
            customCnsInstallFormula: customCnsInstallFormula,
            createSOFDetail: createSOFDetail,
            createDoAllocation: createDoAllocation,
            calc_SalesPrice: calc_SalesPrice,
            dateFormat: dateFormat,
            toFixed: toFixed,
            getAddress: getAddress,
            update_esthrs: update_esthrs,
            getSuiteUIPageLink: getSuiteUIPageLink,
            getRecordNavigationLink: getRecordNavigationLink,
            createDoAllocation_1: createDoAllocation_1,
            createMilestoneForProject_1: createMilestoneForProject_1,
            atRiskProcessAmt: atRiskProcessAmt,
            getCurrentQtrYear: getCurrentQtrYear,
            getProjectYearId: getProjectYearId,
            sofExist: sofExist,
            getMSConfig: getMSConfig,
            CreateEffortHrs: CreateEffortHrs
        };

    });