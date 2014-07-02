/*
 * fis
 * http://fis.baidu.com/
 */

'use strict';

module.exports = function (ret, conf, settings, opt) { //打包后处理
    var asyncCount = 0;
    var siteAsync = null;
    var defaultSettings = {
        scriptTag : '<!--SCRIPT_PLACEHOLDER-->',
        styleTag : '<!--STYLE_PLACEHOLDER-->',
        resourceMapTag : '<!--RESOURCEMAP_PLACEHOLDER-->'
    };
    var idMaps = {};

    //ret.ids内只有map表中的id映射，此处生成全部映射
    fis.util.map(ret.src, function(subpath, file){
        idMaps[file.getId()] = file;
    });

    settings = fis.util.merge(defaultSettings, settings);

    function unique(value, index, self){
        return self.indexOf(value) === index;
    }

    /**
     * 页面中注入JS资源引用
     * @param jsList
     * @param content
     * @returns {XML|string|void}
     */
    function injectJs(jsList, content) {
        var script = jsList.reduce(function (prev, now) {
            var uri = now.uri;
            return [prev, '<script type="text/javascript" src="', uri, '"></script>\r\n'].join('');
        }, '');
        if (content.indexOf(settings.scriptTag) !== -1){
            content = content.replace(settings.scriptTag, script);
        }else{
            content = content.replace(/<\/head>/, script + '\n$&');
        }
        return content;
    }

    /**
     * 页面中注入CSS资源引用
     * @param cssList
     * @param content
     * @returns {XML|string|void}
     */
    function injectCss(cssList, content) {
        var css = cssList.reduce(function (prev, now) {
            var uri = now.uri;
            return prev + '<link rel="stylesheet" type="text/css" href="' + uri + '">\r\n';
        }, '');
        if (content.indexOf(settings.styleTag) !== -1){
            content = content.replace(settings.styleTag, css);
        }else{
            content = content.replace(/<\/head>/, css + '\n$&');
        }
        return content;
    }

    /**
     * 根据异步资源列表生成异步资源配置文件，并加入处理流程中
     * @param asyncList 异步资源列表
     * @param subpath 文件路径
     * @param usedSync 已知引用的模块，用于减化异步表
     * @returns {*}
     */
    function genAsyncMap(asyncList, subpath, usedSync) {
        usedSync = usedSync || {};
        //生成async加载需要使用的resourceMap
        var map = {
            res: {},
            pkg: {}
        };
        asyncList.forEach(function (async) {
            var id = async.getId();
            if (!async){
                fis.log.warning('can\'t find async resource ['+id+']');
                return true;
            }
            if (async.isCssLike){
                return true;
            }
            var r = map.res[id] = {};
            var res = ret.map.res[id];
            if (res.deps) {
                r.deps = res.deps.filter(function (dep) {
                    return !usedSync[dep];
                });
                if (r.deps.length === 0){
                    delete r.deps;
                }
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
                            return !usedSync[dep];
                        });
                        if (map.pkg[res.pkg].deps.length === 0){
                            delete map.pkg[res.pkg].deps;
                        }
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
        idMaps[file.getId()] = file;
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
            fis.util.map(ret.map.res, function (id) {
                asyncList.push(idMaps[id]);
            });
            var subpath = (settings.subpath || 'pkg/map.js').replace(/^\//, '');
            return genAsyncMap(asyncList, subpath);
        }

        if (!siteAsync)
            siteAsync = genSiteAsyncMap();
        return injectAsyncWithMap(content, siteAsync);
    }

    /**
     * 注入异步资源，将会按页面生成异步资源表，并注入页面
     * @param asyncList
     * @param content
     * @returns {*}
     */
    function injectAsync(asyncList, content, usedSync) {
        if (asyncList.length === 0){
            return content.replace(settings.resourceMapTag, '');
        }
        var subpath = 'pkg/page_map_${index}.js'.replace('${index}', asyncCount);
        var file = genAsyncMap(asyncList, subpath, usedSync);
        asyncCount++;
        return injectAsyncWithMap(content, file);
    }

    function injectAsyncWithMap(content, resourceMapFile){
        var mapScript;
        if (settings.useInlineMap){
            mapScript = '<script type="text/javascript" >\r\n' + resourceMapFile.getContent() + '\r\n</script>';
        }else{
            mapScript = '<script type="text/javascript" data-single="true" src="' + resourceMapFile.getUrl(opt.hash, opt.domain) + '"></script>';
        }
        if (content.indexOf(settings.resourceMapTag) !== -1){
            content = content.replace(settings.resourceMapTag, mapScript);
        }else{
            content = content.replace(/<\/head>/, mapScript + '\n$&');
        }
        return content;
    }

    /**
     * 获取同步资源依赖
     * @param file
     * @param added 已经处理过的同步资源
     * @returns {Array}
     */
    function getDepList(file, added) {
        var depList = [];
        added = added || {};
        file.requires.forEach(function (depId) {
            if (added[depId]) {
                return false;
            }
            added[depId] = true;
            var dep = idMaps[depId];
            if (!dep){
                fis.log.warning('can\'t find dep resource ['+depId+']');
                return true;
            }
            depList = depList.concat(getDepList(dep, added));
            depList.push(dep);
        });
        return depList;
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
            var dep = idMaps[depId];
            if (!dep){
                fis.log.warning('can\'t find dep resource ['+depId+']');
                return true;
            }
            asyncList = asyncList.concat(getAsyncList(dep, added, depScaned));
        });
        file.extras && file.extras.async && file.extras.async.forEach(function (asyncId) {
            if (added[asyncId]) {
                return false;
            }
            added[asyncId] = true;
            var async = idMaps[asyncId];
            if (!async){
                fis.log.warning('can\'t find async resource ['+asyncId+']');
                return true;
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
     * @param include
     */
    function injectAutoLoad(file, include) {
        var depList = getDepList(file);
        var asyncList = getAsyncList(file);
        var jsList = [];
        var cssList = [];
        //将include资源添加入异步资源
        asyncList = asyncList.concat(include);
        asyncList = asyncList.filter(function (async, index) {
            //去除重复资源
            if (asyncList.indexOf(async) !== index){
                return false;
            }
            //将样式表资源强制设定为同步加载，避免异步加载样式表
            if (async.isCssLike) {
                depList.push(async);
                return false;
            }
            return true;
        });
        //生成同步资源引用列表
        var usedPkg = {};
        var usedSync= {};
        depList.forEach(function (dep) {
            var res = ret.map.res[dep.getId()];
            if (!res){
                fis.log.notice("autoload: [" + dep.getId() + "] is required, but ignored since it's not in map.json");
                return true;
            }
            usedSync[dep.getId()] = true;
            //将离散资源替换为打包资源
            if (res.pkg && ret.map.pkg[res.pkg]){
                if (usedPkg[res.pkg]){
                    return true;
                }
                ret.map.pkg[res.pkg].has.forEach(function(has){
                    usedSync[has] = true;
                });
                usedPkg[res.pkg] = true;
                res = ret.map.pkg[res.pkg];
            }
            if (dep.isJsLike)
                jsList.push(res);
            else if (dep.isCssLike)
                cssList.push(res);
            else
                fis.log.notice('autoload: [' + dep.getId() + '] is required, but ignored since it\'s not javascript or stylesheet')
        });
        asyncList = asyncList.filter(function (async) {
            return !usedSync[async.getId()];
        });
        var content = file.getContent();
        content = injectCss(cssList, content);
        if (settings.useSiteMap) {
            content = injectSiteAsync(content);
        } else {
            content = injectAsync(asyncList, content, usedSync);
        }
        content = injectJs(jsList, content);
        file.setContent(content);
    }

    var includeAsyncList = [];

    fis.util.map(ret.src, function (subpath, file) {
        if (settings.include && (file.isJsLike || file.jsCssLike) && file.release && fis.util.filter(subpath, settings.include)){
            includeAsyncList.push(file);
            includeAsyncList = includeAsyncList.concat(getDepList(file), getAsyncList(file));
        }
    });

    fis.util.map(ret.src, function (subpath, file) {
        if (file.isHtmlLike) {
            injectAutoLoad(file, includeAsyncList);
        }
    });
};
