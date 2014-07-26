function listGet(list2, n) {
    var size = list2[0];
    var list = list2[1];
    var m;
    while (size !== 1) {
        m = (size / 2) | 0;
        if (n < m) {
            list = list[0];
            size = m;
        } else {
            list = list[1];
            size = size - m;
            n = n - m;
        }
    }
    return list;
}

function _listSet(size, list, n, x) {
    if (size === 1) {
        return x;
    }
    var m = (size / 2) | 0;
    if (n < m) {
        return [ _listSet(m, list[0], n, x), list[1] ];
    } else {
        return [ list[0], _listSet(size - m, list[1], n - m, x) ];
    }
}

function listSet(list, n, x) {
    //return [list[0], _listSet(list[0], list[1], n, x)];
    return fastListSet(list, n, x);
}

function fastListSet(list, n, x) {
    var size = list[0];
    var s = size;
    list = list[1];
    var stack = 0;

    while (s > 1) {
        var m = (s / 2) | 0;
        if (n < m) {
            s = m;
            stack = [[1, list[1]], stack];
            list = list[0];
        } else {
            s = s - m;
            n = n - m;
            stack = [[0, list[0]], stack];
            list = list[1];
        }
    }

    var res = x;

    while (typeof stack === 'object') {
        var head = stack[0];
        if (head[0]) {
            res = [res, head[1]];
        } else {
            res = [head[1], res];
        }
        stack = stack[1];
    }
    return [size, res];
}

function listLength(list) {
    return list[0];
}

function slowListLength(list) {
    var n = 0;
    while (typeof list === 'object') {
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
        var m = (n / 2) | 0;
        var left = _listFromSlowList(arr, m);
        var right = _listFromSlowList(left[1], n - m);
        return [[left[0], right[0]], right[1]];
    }

    var len = slowListLength(arr);
    return [len, _listFromSlowList(arr, len)[0]];
}

function listIterate(list, f) {
    var i = 0;
    function _listIterate(list, length, i) {
        if(length === 1) {
            f(list, i);
        } else {
            var halfLength = (length / 2) | 0;
            _listIterate(list[0], halfLength, i);
            _listIterate(list[1], length - halfLength, i + halfLength);
        }
    }
    _listIterate(list[1], list[0], 0);
}

function matrixSet(mx, pos, x) {
    return listSet(mx, pos[1], listSet(listGet(mx, pos[1]), pos[0], x));
}

function matrixGet(mx, pos, x) {
    return listGet(listGet(mx, pos[1]), pos[0]);
}

function matrixIterate(mx, f) {
    function rowIterate(row, i) {
        function cellIterate(v, j) {
            f(v, i, j);
        }
        listIterate(row, cellIterate);
    }
    listIterate(mx, rowIterate);
}

function genList(n, f) {
    function _genList(n) {
        if (n === 1)
            return f();
        var m = (n / 2) | 0;
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

// heap struct: [[value, size], [ptr1, ptr2]]
function heapPop(heap) {
    var val = heap[0];
    var x = val[0];
    var size = val[1];
    var ptr = heap[1];
    var p, res;
    if (typeof ptr[0] === 'number') {
        if (typeof ptr[1] === 'number') {
            return [x, 0];
        } else {
            p = 1;
        }
    } else {
        if (typeof ptr[1] === 'number') {
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

    if (p) {
        res = heapPop(ptr[1]);
        return [x, [[res[0], size-1], [ptr[0], res[1]]]];
    } else {
        res = heapPop(ptr[0]);
        return [x, [[res[0], size-1], [res[1], ptr[1]]]];
    }
}

function heapSize(heap) {
    if (typeof heap === 'number')
        return 0;
    return heap[0][1];
}

function heapPush(heap, x) {
    if (typeof heap === 'number') {
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
    while (typeof arr === 'object') {
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

function calcPaths(map, pos, canGo, bounty) {

    var Y = listLength(map);
    var X = listLength(listGet(map, 0));

    function genCell() {
        return -1;
    }
    var res = genMatrix(X, Y, genCell);
    res = matrixSet(res, pos, 0);

    var toDo = 0;
    toDo = heapPush(toDo, [pos, 0]);

    while (heapSize(toDo) > 0) {
        var popRes = heapPop(toDo);
        var t = popRes[0][1];
        pos = popRes[0][0];
        toDo = popRes[1];

        if (t < 127 * 80) {

            var d = 0;
            while (d < 4) {
                var newPos = shiftDir(pos, d);
                if (canGo(matrixGet(map, newPos)) >= 0 && matrixGet(res, newPos) === -1) {
                    var dt = canGo(matrixGet(map, pos)); //TODO: save in toDo!
                    res = matrixSet(res, newPos, t + dt);
                    toDo = heapPush(toDo, [newPos, t + dt]);
                }
                d = d + 1;
            }

        }
    }

    return res;
}

function flatRow(row, f, b) {

    function _flatRow(row, x, n, a) {
        if (n === 1) {
            return f(x, row, a);
        }
        var m = (n / 2) | 0;
        a = _flatRow(row[1], x + m, n - m, a);
        return _flatRow(row[0], x, m, a);
    }

    return _flatRow(row[1], 0, row[0], b);
}

function flatMatrix(mx) {

    function processRow(y, d, tail) {

        function processCell(x, r, tail) {
            if (r >= 0) {
                return [[[x, y], r], tail];
            } else {
                return tail;
            }
        }

        return flatRow(d, processCell, tail);
    }

    return flatRow(mx, processRow, 0);
}

function flatAndSort(mx) {
    var val = flatMatrix(mx);
    return heapSort(val);
}

function calcSmell(map, paths, canGo, bounty) {
    var Y = listLength(map);
    var X = listLength(listGet(map, 0));
    var res;
    function genCell() {
        return 0;
    }
    var res = genMatrix(X, Y, genCell);
    var sortedPaths = flatAndSort(paths);

    while (typeof sortedPaths === 'object') {
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
                    var newVal = (myVal * 8 / 10) | 0; // ALPHA
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
}

function id(x) {
    return x;
}
function convertRow(x) {
    var val = listFromSlowList(x, id);
    return val;
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

function tplGetter(tpl, length) {
    function getter(i) {
        return tplGet(tpl, length, i);
    }
    return getter;
}


function applyStatusesToMap(map, ghostsStatuses, fruitStatus) {
    var ghostStatus;
    while(typeof ghostsStatuses === 'object') {
        ghostStatus = ghostsStatuses[0];
        ghostsStatuses = ghostsStatuses[1];
        map = matrixSet(map, tplGet(ghostStatus, 3, 1), 6);
    }
    return map;
}

function step(aiState, worldState) {
    worldState = tplGetter(worldState, 4);
    var map = worldState(0),
        lmStatus = worldState(1),
        ghostsStatuses = worldState(2),
        fruitStatus = worldState(3);
    map = listFromSlowList(map, convertRow);
    //map = applyStatusesToMap(map, ghostsStatuses, fruitStatus);

    /*
     * 0: Wall (`#`)
     * 1: Empty (`<space>`)
     * 2: Pill
     * 3: Power pill
     * 4: Fruit location
     * 5: Lambda-Man starting position
     * 6: Ghost starting position
    */
    function canGo(cell) {
        if (cell === 5)
            return 0;
        if (cell === 1)
            return 127;
        if (cell === 2 || cell === 3 || cell === 4)
            return 137;
        return -1;
    }

    function bounty(cell) {
        if (cell === 2)
            return 10000;
        if (cell === 3)
            return 50000; // TODO: 0 if in power mode!
    //    if (cell === 4)
    //        return 1000000; //FIXME: only if fruit is present!
        return 0;
    }

    var myPos = tplGet(lmStatus, 5, 1),
        paths = calcPaths(map, myPos, canGo, bounty),
        smell = calcSmell(map, paths, canGo, bounty),
        d = 0,
        bestSmell = 0,
        bestD = 0;
    while (d < 4) {
        var val = matrixGet(smell, shiftDir(myPos, d));
        if (val > bestSmell) {
            bestSmell = val;
            bestD = d;
        }
        d = d + 1;
    }

    return [[paths, smell], bestD];
}

///*
function nodejsMain() {
    function toHtml(map, mx) {
        var _map = [];
        function mapIterate(cell, i, j) {
            (_map[i] || (_map[i] = []))[j] = cell;
        }
        matrixIterate(map, mapIterate);

        var _mx = [];
        function mxIterate(v, i, j) {
            (_mx[i] || (_mx[i] = []))[j] = v;
        }
        matrixIterate(mx, mxIterate);

        var res = '<table border="1" cellspacing="0" cellpadding="0">';
        for(var i = 0; i < _map.length; i++) {
            var mapRow = _map[i] || [],
                row = _mx[i] || [];
            res += '<tr>';
            for(var j = 0; j < mapRow.length; j++) {
                res += '<td>' +
                    ({ '0': '#', '1': ' ', '2': '.', '3': 'o', '4': '%', '5': '\\', '6': '=' }[mapRow[j]]) +
                    '<sup>' + (typeof row[j] === 'undefined' ? '' : row[j]) + '</sup>' +
                    '</td>';
            }
            res += '</tr>';
        }
        return res += '</table>'
    }

    function readMap(map) {
        var lmVitality = 0,
            lmPos,
            lmDirection = 1,
            lmLives = 3,
            lmScore = 0
            ghostsStatuses = 0,
            fruitStatus = 0;

        map = map.reduceRight(function(a, x, i) {
            x = x.split("").reduceRight(function(b, y, j) {
                if(y === '\\') {
                    lmPos = [i, j];
                } else if(y === '=') {
                    ghostsStatuses = [[0, [[i, j], 0]], ghostsStatuses];
                }
                return [{ '#': 0, ' ': 1, '.': 2, 'o': 3, '%': 4, '\\': 5, '=': 6 }[y], b];
            }, 0);
            return [x, a];
        }, 0);

        var lmStatus = [lmVitality, [lmPos, [lmDirection, [lmLives, lmScore]]]];

        return [map, [lmStatus, [ghostsStatuses, fruitStatus]]];
    }

    var FS = require('fs'),
        map = FS.readFileSync('map1.txt', 'utf8').replace(/\n$/, '').split('\n'),
        worldState = readMap(map),
        res = step(0, worldState);

    console.log("res: ", JSON.stringify(res));
    map = listFromSlowList(worldState[0], convertRow);
    FS.writeFileSync('map.html',
        toHtml(map, res[0][0]) +
        '<br/>' +
        toHtml(map, res[0][1]) +
        '<br/>' + res[1]);
}

nodejsMain();
//*/

[0, step];
