/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';

module.exports = function (ret, settings, conf, opt) { //打包后处理
    var asyncCount = 0;
    var siteAsync = null;

    /**
     * 页面中注入JS资源引用
     * @param jsList
     * @param content
     * @returns {XML|string|void}
     */
    function injectJs(jsList, content) {
        var script = jsList.reduce(function (prev, now) {
            var uri = now.getUrl(opt.hash, opt.domain);
            return prev + '<script src="' + uri + '"></script>\r\n';
        }, '');
        return content.replace(/<\/head>/, script + '\n$&');
    }

    /**
     * 页面中注入CSS资源引用
     * @param cssList
     * @param content
     * @returns {XML|string|void}
     */
    function injectCss(cssList, content) {
        var css = cssList.reduce(function (prev, now) {
            var uri = now.getUrl(opt.hash, opt.domain);
            return prev + '<link rel="stylesheet" href="' + uri + '">\r\n';
        }, '');
        return content.replace(/<\/head>/, css + '\n$&');
    }

    /**
     * 根据异步资源列表生成异步资源配置文件，并加入处理流程中
     * @param asyncList 异步资源列表
     * @param subpath 文件路径
     * @returns {*}
     */
    function genAsyncMap(asyncList, subpath) {
        //生成async加载需要使用的resourceMap
        var map = {
            res: {},
            pkg: {}
        };
        asyncList.forEach(function (async) {
            var id = async.getId();
            if (ret.ids[id]){
                if (ret.ids[id].isCssLike){
                    return false;
                }
            }else{
                fis.log.error('can\'t find async resource ['+id+']');
            }
            var r = map.res[id] = {};
            var res = ret.map.res[id];
            if (res.deps) {
                r.deps = res.deps.filter(function (dep) {
                    var file = ret.ids[dep];
                    if (!file || file.isCssLike)
                        return false;
                    return true;
                });
            }
            //有打包的话就不要加url了，以减少map.js的体积
            if (res.pkg) {
                r.pkg = res.pkg;
                if (!map.pkg[res.pkg]) {
                    var map_pkg = ret.map.pkg[res.pkg];
                    map.pkg[res.pkg] = {
                        url: map_pkg.uri
                    };
                    if (map_pkg.deps) {
                        map.pkg[res.pkg].deps = map_pkg.deps.filter(function (dep) {
                            var file = ret.ids[dep];
                            if (!file || file.isCssLike)
                                return false;
                            return true;
                        });
                    }
                }
            } else {
                r.url = res.uri;
            }
        });
        var code = 'require.resourceMap(' + JSON.stringify(map, null, opt.optimize ? null : 4) + ');';
        //构造map.js配置文件
        var file = fis.file(fis.project.getProjectPath(), subpath);
        file.setContent(code);
        ret.pkg[subpath] = file;
        ret.ids[file.getId()] = file;
        ret.map.res[file.getId()] = {
            uri: file.getUrl(opt.hash, opt.domain),
            type: "js"
        };
        return file;
    }

    /**
     * 注入异步资源，将会注入整站资源表，每个页面均使用相同的资源表
     * @param content
     * @returns {XML|string|void}
     */
    function injectSiteAsync(content) {
        function genSiteAsyncMap() {
            var asyncList = [];
            fis.util.map(ret.map.res, function (id, res) {
                asyncList.push(ret.ids[id]);
            });
            var subpath = (conf.subpath || 'pkg/map.js').replace(/^\//, '');
            return genAsyncMap(asyncList, subpath);
        }

        if (!siteAsync)
            siteAsync = genSiteAsyncMap();
        var script = '<script data-single="true" src="' + siteAsync.getUrl(opt.hash, opt.domain) + '"></script>';
        return content.replace(/<\/head>/, script + '\n$&');
    }

    /**
     * 注入异步资源，将会按页面生成异步资源表，并注入页面
     * @param asyncList
     * @param content
     * @returns {*}
     */
    function injectAsync(asyncList, content) {
        if (asyncList.length === 0)
            return content;
        var subpath = 'pkg/page_map_${index}.js'.replace('${index}', asyncCount);
        var file = genAsyncMap(asyncList, subpath);
        asyncCount++;
        var script = '<script data-single="true" src="' + file.getUrl(opt.hash, opt.domain) + '"></script>';
        return content.replace(/<\/head>/, script + '\n$&');
    }

    /**
     * 获取同步资源依赖
     * @param file
     * @param added 已经处理过的同步资源
     * @returns {Array}
     */
    function getDepList(file, added) {
        var deps = [];
        added = added || {};
        file.requires.forEach(function (depId) {
            if (added[depId]) {
                return false;
            }
            added[depId] = true;
            var dep = ret.ids[depId];
            if (!dep){
                fis.log.error('can\'t find dep resource ['+depId+']');
            }
            deps = deps.concat(getDepList(dep, added));
            deps.push(dep);
        });
        return deps;
    }

    /**
     * 获得指定文件的异步资源依赖
     * @param file
     * @param added 已经处理过的异步资源
     * @param depScaned 已经处理过的同步资源
     * @returns {Array}
     */
    function getAsyncList(file, added, depScaned) {
        var asyncList = [];
        added = added || {};
        depScaned = depScaned || {};
        //对同步依赖进行异步依赖检查
        file.requires.forEach(function (depId) {
            if (depScaned[depId]) {
                return false;
            }
            depScaned[depId] = true;
            var dep = ret.ids[depId];
            if (!dep){
                fis.log.error('can\'t find dep resource ['+depId+']');
            }
            asyncList = asyncList.concat(getAsyncList(dep, added, depScaned));
        });
        file.extras && file.extras.async && file.extras.async.forEach(function (asyncId) {
            if (added[asyncId]) {
                return false;
            }
            added[asyncId] = true;
            var async = ret.ids[asyncId];
            if (!async){
                fis.log.error('can\'t find async resource ['+asyncId+']');
            }
            asyncList = asyncList.concat(getAsyncList(async, added, depScaned));
            //异步资源依赖需要递归添加所有同步依赖
            asyncList = asyncList.concat(getDepList(async, added));
            asyncList.push(async);
        });
        return asyncList;
    }

    /**
     * 对类HTML文件进行资源加载注入
     * @param file
     */
    function injectAutoLoad(file) {
        var depList = getDepList(file);
        var asyncList = getAsyncList(file);
        var jsList = [];
        var cssList = [];
        //将同步资源从异步资源中剔除
        asyncList = asyncList.filter(function (async) {
            if (depList.indexOf(async) == -1) {
                //将样式表资源强制设定为同步加载，避免异步加载样式表
                if (async.isCssLike) {
                    depList.push(async);
                    return false;
                }
                return true;
            }
            return false;
        });
        depList.forEach(function (dep) {
            if (dep.isJsLike)
                jsList.push(dep);
            else if (dep.isCssLike)
                cssList.push(dep);
            else
                fis.log.warning('[' + dep.getId() + '] is required, but ignored since it\'s not javascript or stylesheet')
        });
        var content = file.getContent();
        content = injectCss(cssList, content);
        if (conf.useSiteMap) {
            content = injectSiteAsync(content);
        } else {
            content = injectAsync(asyncList, content);
        }
        content = injectJs(jsList, content);
        file.setContent(content);
    }

    fis.util.map(ret.src, function (subpath, file) {
        if (file.isHtmlLike) {
            injectAutoLoad(file);
        }
    });
};
