function isArray(x) {
    return (typeof x === 'object');
}

function div(n, m) {
    return (n - (n % m)) / m;
    //return n / m;
}

function _listGet(size, list, n) {
    if (size === 1) // n === 0
        return list;
    var m = div(size, 2);
    if (n < m) {
        return _listGet(m, list[0], n);
    } else {
        return _listGet(size - m, list[1], n - m);
    }
}

function listGet(list, n) {
    return _listGet(list[0], list[1], n);
}

function _listSet(size, list, n, x) {
    if (size === 1) {
        if (n)
            throw "aa";
        return x;
    }
    var m = div(size, 2);
    if (n < m) {
        return [ _listSet(m, list[0], n, x), list[1] ];
    } else {
        return [ list[0], _listSet(size - m, list[1], n - m, x) ];
    }
}

function listSet(list, n, x) {
    return [list[0], _listSet(list[0], list[1], n, x)];
}

function listLength(list) {
    return list[0];
}

function slowListLength(list) {
    var n = 0;
    while (isArray(list)) {
        list = list[1];
        n = n + 1;
    }
    return n;
}

function listFromSlowList(arr, f) {

    function _listFromSlowList(arr, n) {
        if (n === 1) {
            return [f(arr[0]), arr[1]];
        }
        var m = div(n, 2);
        var left = _listFromSlowList(arr, m);
        var right = _listFromSlowList(left[1], n - m);
        return [[left[0], right[0]], right[1]];
    }

    var len = slowListLength(arr);
    return [len, _listFromSlowList(arr, len)[0]];
}

function matrixSet(mx, pos, x) {
    return listSet(mx, pos[1], listSet(listGet(mx, pos[1]), pos[0], x));
}

function matrixGet(mx, pos, x) {
    return listGet(listGet(mx, pos[1]), pos[0]);
}

function genList(n, f) {
    function _genList(n) {
        if (n === 1)
            return f();
        var m = div(n, 2);
        return [ _genList(m), _genList(n-m) ];
    }
    return [n, _genList(n)];
}

function genMatrix(X, Y, f) {
    function genListF() {
        return genList(X, f);
    }
    return genList(Y, genListF);
}

function shiftDir(pos, d) {
    if (d === 0)
        return [pos[0], pos[1] - 1];
    else if (d === 1)
        return [pos[0] + 1, pos[1]];
    else if (d === 2)
        return [pos[0], pos[1] + 1];
    else
        return [pos[0] - 1, pos[1]];
}

/*
 * 0: Wall (`#`)
  * 1: Empty (`<space>`)
  * 2: Pill
  * 3: Power pill
  * 4: Fruit location
  * 5: Lambda-Man starting position
  * 6: Ghost starting position
*/

function fixCell(cell) {
    return ({ '#': 0, ' ': 1, '.': 2, 'o': 3, '%': 4, '\\': 5, '=': 6 }[cell]);
//    return cell;
}

function canGo(cell) {
    cell = fixCell(cell);
    if (cell === 5)
        return 0;
    if (cell === 1)
        return 127;
    if (cell === 2 || cell === 3 || cell === 4)
        return 137;
    return -1;
}

function bounty(cell) {
    cell = fixCell(cell);
    if (cell === 2)
        return 10000;
    if (cell === 3)
        return 50000; // TODO: 0 if in power mode!
    if (cell === 4)
        return 1000000; //FIXME: only if fruit is present!
    return 0;
}

/*
function slowListSet(list, n, x) {
    if (n === 0)
        return [x, list[1]];
    else
        return [list[0], slowListSet(list[1], n - 1, x)];
}

function slowListGet(list, n) {
    while (n > 0) {
        list = list[1];
        n = n - 1;
    }
    return list[0];
}

function slowMatrixSet(mx, pos, x) {
    return slowListSet(mx, pos[1], slowListSet(slowListGet(mx, pos[1]), pos[0], x));
}

function slowMatrixGet(mx, pos, x) {
    return slowListGet(slowListGet(mx, pos[1]), pos[0]);
}
*/

function isInt(x) {
    return (typeof x === 'number');
}

function isObject(x) {
    return typeof x === 'object';
}
/*
function slowListRemove(list, n) {
    if (n === 0)
        return list[1];
    return [list[0], slowListRemove(list[1], n - 1)];
}

function extractMinBy2(list) {
    var minVal = list[0], minIdx = 0;
    var idx = 1;
    var iter = list[1];
    while (isArray(iter)) {
        var val = iter[0];
        if (val[1] < minVal[1]) {
            minVal = val;
            minIdx = idx;
        }
        idx = idx + 1;
        iter = iter[1];
    }

    return [minVal, slowListRemove(list, minIdx)];
}

function elemToSlowList(x) {
    return [x, 0];
}

function genSlowList(n, f) {
    if (n === 0)
        return 0;
    return [f(), genList(n-1, f)];
}

function genSlowMatrix(X, Y, f) {
    function genSlowListF() {
        return genSlowList(X, f);
    }
    return genSlowList(Y, genSlowListF);
}
*/

// heap struct: [[value, size], [ptr1, ptr2]]

function heapPop(heap) {
    var val = heap[0];
    var x = val[0];
    var size = val[1];
    var ptr = heap[1];
    var p, res;
    if (isInt(ptr[0])) {
        if (isInt(ptr[1])) {
            return [x, 0];
        } else {
            p = 1;
        }
    } else {
        if (isInt(ptr[1])) {
            p = 0;
        } else {
            var x0 = ptr[0][0][0];
            var x1 = ptr[1][0][0];
            if (x0[1] < x1[1]) {
                p = 0;
            } else {
                p = 1;
            }
        }
    }

    if (p === 0) {
        res = heapPop(ptr[0]);
        return [x, [[res[0], size-1], [res[1], ptr[1]]]];
    } else {
        res = heapPop(ptr[1]);
        return [x, [[res[0], size-1], [ptr[0], res[1]]]];
    }
}

function heapSize(heap) {
    if (isInt(heap))
        return 0;
    return heap[0][1];
}

function heapPush(heap, x) {
    if (isInt(heap)) {
        return [[x, 1], [0, 0]];
    }
    var val = heap[0];
    var y = val[0];
    var size = val[1];
    var ptr = heap[1];

    if (x[1] < y[1]) {
        var z = x; x = y; y = z;
    }
    if (heapSize(ptr[0]) > heapSize(ptr[1])) {
        return [[y, size + 1], [ptr[0], heapPush(ptr[1], x)]];
    } else {
        return [[y, size + 1], [heapPush(ptr[0], x), ptr[1]]];
    }
}

function heapSort(arr) {
    // descending
    var heap = 0;
    while (isArray(arr)) {
        heap = heapPush(heap, arr[0]);
        arr = arr[1];
    }
    var res = 0;
    while (heapSize(heap) > 0) {
        var pop = heapPop(heap);
        res = [pop[0], res];
        heap = pop[1];
    }
    return res;
}

function calcPaths(map, pos) {

    var Y = listLength(map);
    var X = listLength(listGet(map, 0));

    var T = 0;
    function genCell() {
        return -1;
    }
    var res = genMatrix(X, Y, genCell);
    console.log(JSON.stringify(res));
    res = matrixSet(res, pos, 0);
    var toDo = 0;
    heapPush(toDo, [pos, 0]);

    while (heapSize(toDo) > 0) {
        var extractRes = heapPop(toDo);
        var t = extractRes[0][1];
        pos = extractRes[0][0];
        toDo = extractRes[1];

        var d = 0;
        while (d < 4) {
            var newPos = shiftDir(pos, d);
            if (canGo(matrixGet(map, newPos)) >= 0 && matrixGet(res, newPos) === -1) {
                var dt = canGo(matrixGet(map, pos)); //TODO: save in toDo!
                res = matrixSet(res, newPos, t + dt);
                toDo = heapPush([newPos, t + dt]);
            }
            d = d + 1;
        }
    }

    return res;
}

function _flatRow(row, f, x, n, tail) {
    if (n === 1)
        return [[f(x, row), tail]];
    var m = div(n, 2);
    tail = _flatRow(row[1], f, x + m, n - m, tail);
    return _flatRow(row[0], f, x, m, tail);
}

function flatRow(row, f) {
    return _flatRow(row[1], f, 0, row[0], 0);
}

function flatMatrix(mx) {
    function xxx(y, d) {
        function yyy(x, r) {
            return [[x, y], r];
        }
        return flatRow(d, yyy);
    }
    return flatRow(mx, xxx);
}

function flatAndSort(mx) {
    /*
    var res = 0;

    var y = 0;
    while (isArray(mx)) {
        var row = mx[0];
        var x = 0;
        while (isArray(row)) {
            if (row[0] >= 0) {
               res = [[[x, y], row[0]], res];
            }
            x = x + 1;
            row = row[1];
        }
        y = y + 1;
        mx = mx[1];
    }
    */
    var val = flatMatrix(mx);
    //console.log(JSON.stringify(val));
    return heapSort(val);
}

function calcSmell(map, paths) {
    var Y = listLength(map);
    var X = listLength(listGet(map, 0));
    var res;
    function genCell() {
        return 0;
    }
    var res = genMatrix(X, Y, genCell);
    var sortedPaths = flatAndSort(paths);

    while (isArray(sortedPaths)) {
        var pos = sortedPaths[0][0];
        var myVal = matrixGet(res, pos) + bounty(matrixGet(map, pos));
        res = matrixSet(res, pos, myVal);
        var d = 0;
        while (d < 4) {
            var newPos = shiftDir(pos, d);
            if (canGo(matrixGet(map, newPos)) > 0) {
                var t0 = matrixGet(paths, pos);
                var t = matrixGet(paths, newPos);
                if (t === t0 - 127 || t === t0 - 137) {
                    var newVal = myVal * 9 / 10; // ALPHA
                    if (matrixGet(res, newPos) < newVal) {
                        res = matrixSet(res, newPos, newVal);
                    }
                }
            }
            d = d + 1;
        }
        sortedPaths = sortedPaths[1];
    }
    return res;
}

function run(map, myPos) {

    function id(x) {
        return x;
    }
    function convertRow(x) {
        var val = listFromSlowList(x, id);
        return val;
    }

    map = listFromSlowList(map, convertRow);

    var paths = calcPaths(map, myPos);
    console.log(JSON.stringify(paths));
    var smell = calcSmell(map, paths);
    console.log(JSON.stringify(smell));
    var d = 0;
    var bestSmell = 0;
    var bestD = 0;
    while (d < 4) {
        var val = matrixGet(smell, shiftDir(myPos, d));
        if (val > bestSmell) {
            bestSmell = val;
            bestD = d;
        }
        d = d + 1;
    }
    return [bestD, [paths, smell]];
}

function toHtml(map, arr) {
    var res = '<table border="1" cellspacing="0" cellpadding="0">';
    for(var i = 0; i < map.length; i++) {
        var mapRow = map[i],
            row = arr[i] || [];
        res += '<tr>';
        for(var j = 0; j < mapRow.length; j++) {
            res += '<td>' +
                mapRow[j] +
                '<sup>' + (typeof row[j] === 'undefined' ? '' : row[j]) + '</sup>' +
                '</td>';
        }
        res += '</tr>';
    }
    return res += '</table>'
}

function fixMap(map) {
    return map.reduceRight(function(a, x) {
        x = x.split("").reduceRight(function(b, y) {
            return [y, b];
        }, 0);
        return [x, a];
    }, 0);
}

function unFixRow(row) {
    var res = [];
    while (typeof row === 'object') {
        res.push(row[0]);
        row = row[1];
    }
    return res;
}

function unFixMap(map) {
    var res = [];
    while (typeof map === 'object') {
        res.push(unFixRow(map[0]));
        map = map[1];
    }
    return res;
}

var FS = require('fs'),
    map = FS.readFileSync('map.txt', 'utf8').split('\n');
map.pop();

var res = run(fixMap(map), [3, 2]);
console.log("res: ", res[0]);
//FS.writeFileSync('map.html', toHtml(map, unFixMap(res[0][0])) + toHtml(map, unFixMap(res[0][1])) + "<br/>" + res[1]);
//*/
function tplGetter(tpl, length) {
    function getter(i) {
        return tplGet(tpl, length, i);
    }
    return getter;
}

function tplGet(tpl, length, i) {
    if(i === 0) {
        return tpl[0];
    } else if(i === 1 && length === 2) {
        return tpl[1];
    } else {
        return tplGet(tpl[1], length - 1, i - 1);
    }
}

function applyStatusesToMap(map, ghostsStatuses, fruitStatus) {
    var ghostStatus;
    while(isObject(ghostsStatuses)) {
        ghostStatus = ghostsStatuses[0];
        ghostsStatuses = ghostsStatuses[1];
        map = slowMatrixSet(map, tplGet(ghostStatus, 3, 1), 6);
    }
    return map;
}

function step(aiState, worldState) {
    worldState = tplGetter(worldState, 4);
    var map = worldState(0),
        lmStatus = worldState(1),
        ghostsStatuses = worldState(2),
        fruitStatus = worldState(3);
    map = applyStatusesToMap(map, ghostsStatuses, fruitStatus);
    var myPos = tplGet(lmStatus, 5, 1);
    return [aiState, run(map, myPos)];
}

[0, step];
