///<reference path='../node_modules/immutable/dist/immutable.d.ts'/>
import Immutable = require('immutable');
import Type = require('./types');

enum BLAME_CONTEX_KIND {
  FUN,
  PROP
}

export enum BLAME_POLARITY {
  POSITIVE,
  NEGATIVE
}

interface MutableBlameNode {
  counterState: number;
  kind: SEGMENT_KIND;
  parent: MutableBlameNode 
}

type BlameSignature = Immutable.List<BlameContext>;
type BlameState = BlameSet[];

type BlameSet =
   {
     FUN?: {POSITIVE: {[counter: number]: BlameSet};
            NEGATIVE: {[counter: number]: BlameSet}};
     PROP?: {
       POSITIVE: {[prop: string]:
                  {[counter: number]: BlameSet}};
       NEGATIVE: {[prop: string]:
                  {[counter: number]: BlameSet}}};
   };

function newBlameSet(): BlameSet {
  return {FUN: {POSITIVE: {}, NEGATIVE: {}},
          PROP: {POSITIVE: {}, NEGATIVE: {}}};
}

function addRouteToSet(route: Immutable.List<BlameContext>, blameSet: BlameSet): void {
  if(route.size === 0) { return; }
  var current = route.first();
  var pointer = blameSet;

  switch(current.get('kind')) {
  case BLAME_CONTEX_KIND.FUN:
    pointer = pointer.FUN;
    pointer = pointer[BLAME_POLARITY[current.get('polarity')]];
    if(pointer[current.get('counter')] == null) {
      pointer[current.get('counter')] = newBlameSet();
    }
    return addRouteToSet(route.shift(),pointer[current.get('counter')]);
  case BLAME_CONTEX_KIND.PROP:
    pointer = pointer.PROP;
    pointer = pointer[BLAME_POLARITY[current.get('polarity')]];
    if(pointer[current.get('prop')] == null) {
      pointer[current.get('prop')] = {};
    }
    pointer = pointer[current.get('prop')];
    if(pointer[current.get('counter')] == null) {
      pointer[current.get('counter')] = newBlameSet();
    }
    return addRouteToSet(route.shift(),pointer[current.get('counter')]);
  }
}

function findNegativeCounterExample(candidate: Immutable.List<BlameContext>,
                                    blameSet: BlameSet)
: boolean
{
  if(candidate.size === 0) {
    return false;
  }
  var fst = candidate.first();
  var pointer = blameSet;
  switch(fst.get('kind')) {
  case BLAME_CONTEX_KIND.FUN: {
    pointer = pointer.FUN;
    var negatedPointer = pointer[BLAME_POLARITY[negatePolarity(fst.get('polarity'))]];
    if(negatedPointer[fst.get('counter')]) {
      return true;
    }
    pointer = pointer[BLAME_POLARITY[fst.get('polarity')]];
    if(pointer[fst.get('counter')]) {
      return findNegativeCounterExample(candidate.shift(),pointer[fst.get('counter')]);
    } else {
      return false;
    }
  }
  case BLAME_CONTEX_KIND.PROP: {
    pointer = pointer.PROP;
    var negatedPointer = pointer[BLAME_POLARITY[negatePolarity(fst.get('polarity'))]];
    if(negatedPointer[fst.get('prop')]
       && negatedPointer[fst.get('prop')][fst.get('counter')]) {
      return true;
    }
    pointer = pointer[BLAME_POLARITY[fst.get('polarity')]];
    if(pointer[fst.get('prop')]
       && pointer[fst.get('prop')][fst.get('counter')]) {
      return findNegativeCounterExample(
        candidate.shift(),
        pointer[fst.get('prop')][fst.get('counter')]);
    } else {
      return false;
    }
  }
  }
}

function matchContext(candidate: Immutable.List<BlameContext>,
                      blameSet: BlameSet)
: boolean
{
  if(candidate.size === 0) {
    throw new Error("Should never try to match context with empty route");
  }
  var fst = candidate.first();
  var pointer = blameSet;
  switch(fst.get('kind')) {
  case BLAME_CONTEX_KIND.FUN: {
    pointer = pointer["FUN"];
    var plusPointer = pointer["POSITIVE"];
    var negPointer = pointer["NEGATIVE"];
    return (plusPointer[fst.get('counter')] || negPointer[fst.get('counter')]);
  }
  case BLAME_CONTEX_KIND.PROP: {
    pointer = pointer.PROP;
    var plusPointer = pointer["POSITIVE"];
    var negPointer = pointer["NEGATIVE"];

    return ((plusPointer[fst.get('prop')] &&
             plusPointer[fst.get('prop')][fst.get('counter')]) ||
            (negPointer[fst.get('prop')] &&
             negPointer[fst.get('prop')][fst.get('counter')]))
  }
  }
}

interface MutableBlameLabel extends MutableBlameNode {
  label: string;
}

interface MutableBlameBranch extends MutableBlameNode {
  interType: Type.IType[];
  blameState: BlameState;
  branchIndex: number;
}

interface MutableBlameContext extends MutableBlameNode {
  counter: number;
  routeKind: BLAME_CONTEX_KIND;
  polarity: BLAME_POLARITY;
  prop?: string
}

interface BlameContext extends Immutable.Map<string,any> {
//  kind: BLAME_CONTEX_KIND;
//  polarity: BLAME_POLARITY;
//  idx: number;
//  prop?: string;
}

var BlameContext = Immutable.Record({
  kind: null,
  polarity: null,
  counter: null,
  prop: null
});

export function createAppContext(polarity: BLAME_POLARITY, counter: number) {
  return new BlameContext({
    kind: BLAME_CONTEX_KIND.FUN,
    polarity: polarity,
    counter: counter
  });
}

export function createPropContext(polarity: BLAME_POLARITY,
                           counter: number,
                           prop: string) {
  return new BlameContext({
    kind: BLAME_CONTEX_KIND.PROP,
    polarity: polarity,
    counter: counter,
    prop: prop
  });
}

enum SEGMENT_KIND {
  LABEL,
  BRANCH,
  CONTEXT
}

export function createLabelMutable(label: string): MutableBlameLabel {
  return {  kind: SEGMENT_KIND.LABEL,
            label: label,
            parent: null,
            counterState: 0,
         }
}

export function createBranchMutable(idx: number,
                                    ty: Type.IType[],
                                    parent: MutableBlameNode,
                                    blameState: BlameState
                                   )
: MutableBlameBranch {
  blameState[idx] = newBlameSet();
  return {
    kind: SEGMENT_KIND.BRANCH,
    interType: ty,
    blameState: blameState,
    branchIndex: idx,
    parent: parent,
    counterState: 0,
  }
}

function createRouteMutable(kind: BLAME_CONTEX_KIND,
                                   polarity: BLAME_POLARITY,
                                   parent: MutableBlameNode,
                                   prop?: string)
: MutableBlameContext {
  var i = parent.counterState;
  parent.counterState++;
  return {
    kind: SEGMENT_KIND.CONTEXT,
    routeKind: kind,
    polarity: polarity,
    counterState: 0,
    prop: prop,
    counter: i,
    parent: parent
  }
}

export function createAppContextMutable(parent: MutableBlameNode)
: {dom: MutableBlameContext; cod: MutableBlameContext} {
  var i = parent.counterState;
  parent.counterState++;
  return {
    dom: {
      kind: SEGMENT_KIND.CONTEXT,
      routeKind: BLAME_CONTEX_KIND.FUN,
      polarity: BLAME_POLARITY.NEGATIVE,
      counterState: 0,
      prop: null,
      counter: i,
      parent: parent
    },
    cod: {
      kind: SEGMENT_KIND.CONTEXT,
      routeKind: BLAME_CONTEX_KIND.FUN,
      polarity: BLAME_POLARITY.POSITIVE,
      counterState: 0,
      prop: null,
      counter: i,
      parent: parent
    }
  }
}

export function createPropContextMutable(polarity: BLAME_POLARITY,
                                         prop: string,
                                         parent: MutableBlameNode)
: MutableBlameContext {
  return createRouteMutable(
    BLAME_CONTEX_KIND.PROP,
    polarity,
    parent,
    prop);
}

function extractRoute(node: MutableBlameNode, polarity: BLAME_POLARITY)
: { route: Immutable.List<BlameContext>;
    parent: MutableBlameNode;
    polarity: BLAME_POLARITY
  }
{ return extractRouteRec(node,[],polarity); }

function extractRouteRec(node: MutableBlameNode,
                         route: BlameContext[],
                         currentPolarity: BLAME_POLARITY)
: { route: Immutable.List<BlameContext>;
    parent: MutableBlameNode;
    polarity: BLAME_POLARITY
  }
{
  switch(node.kind) {
  case SEGMENT_KIND.CONTEXT: {
    var ctxNode = <MutableBlameContext> node;
    var ctx = new BlameContext({
      kind: ctxNode.routeKind,
      polarity: ctxNode.polarity,
      counter: ctxNode.counter,
      prop: ctxNode.prop
    });
    var newPolarity = (ctxNode.polarity === BLAME_POLARITY.NEGATIVE) ?
      negatePolarity(currentPolarity) : currentPolarity;
    route.push(ctx);
    return extractRouteRec(node.parent,route,newPolarity);
  }
  default: {
    route.reverse();
    return {
      route: Immutable.List<BlameContext>(route),
      parent: node,
      polarity: currentPolarity
    };
  }
  }
}

function negatePolarity(polarity: BLAME_POLARITY): BLAME_POLARITY {
  switch(polarity) {
  case BLAME_POLARITY.POSITIVE: return BLAME_POLARITY.NEGATIVE;
  case BLAME_POLARITY.NEGATIVE: return BLAME_POLARITY.POSITIVE;
  }
}

var SILENT_MODE = true;
export function enableSilentMode(v: boolean): void {
  SILENT_MODE = v;
}

function raiseTopLevelBlame(v: any, node: MutableBlameNode): any {
  if(SILENT_MODE) {
    console.error("BLAME: " + prettyPrintMutable(node));
    return v;
  } else {
    throw new Error(prettyPrintMutable(node));
  }
}

export function blameContext(v: any, offender: MutableBlameNode): any {
  return _blame(v,
                     offender,
                     offender,
                     Immutable.List<BlameContext>(),
                     BLAME_POLARITY.NEGATIVE
                    );
}

export function blame(v: any, offender: MutableBlameNode): any {
  return _blame(v,
                offender,
                offender,
                Immutable.List<BlameContext>(),
                BLAME_POLARITY.POSITIVE
               );
}

function blameBranch(v: any,
                     blamedBranch: MutableBlameBranch,
                     full: MutableBlameNode,
                     route: Immutable.List<BlameContext>,
                     polarity: BLAME_POLARITY
                    )
:any {
  switch(polarity) {
  case BLAME_POLARITY.POSITIVE: {
    var counterExample =
      findNegativeCounterExample(route,
                                 blamedBranch.blameState[blamedBranch.branchIndex]);
    if (counterExample) {
      return v;
    } else {
      return _blame(v,
                         blamedBranch.parent,
                         full,
                         route,
                         polarity);
    }
  }
  case BLAME_POLARITY.NEGATIVE: {
    addRouteToSet(route,blamedBranch.blameState[blamedBranch.branchIndex]);
    var monitoredBranches = [];
    blamedBranch.interType.forEach(
      (ty,i) => {
        if((i !== blamedBranch.branchIndex) &&
           (monitors(ty,route.first()))) {
          monitoredBranches.push(i);
        }
      });
    if(monitoredBranches.length === 0) {
      return _blame(v,
                         blamedBranch.parent,
                         full,
                         route,
                         polarity);
    } else {
      var blameObservations = monitoredBranches.every(
        idx => matchContext(route,blamedBranch.blameState[idx]));
      if(blameObservations) {
        return _blame(v,
                           blamedBranch.parent,
                           full,
                           route,
                           polarity);
      } else {
        return v;
      }
    }
  }
  }
}

function _blame(v: any,
                     offender: MutableBlameNode,
                     full: MutableBlameNode,
                     extraRoute: Immutable.List<BlameContext>,
                     polarity: BLAME_POLARITY
                    )
: any {
  switch(offender.kind) {
  case SEGMENT_KIND.LABEL:
    return raiseTopLevelBlame(v,full);
  case SEGMENT_KIND.BRANCH:
    var blamedBranch = <MutableBlameBranch> offender;
    return blameBranch(v,blamedBranch,full,extraRoute,polarity);
    // This will happen when a flat branch of an intersection raises blame.
    // E.g. INT \inter ANY
  case SEGMENT_KIND.CONTEXT:
    var routeInfo = extractRoute(offender,polarity);

    // Collect the route up to the nearest label / branch
    // If label then raise top level.
    if(routeInfo.parent.kind === SEGMENT_KIND.LABEL) {
      return raiseTopLevelBlame(v,full);
    }

    // Blaming Intersection Branch
    var blamedBranch = <MutableBlameBranch> routeInfo.parent;

    var route = routeInfo.route;
    if(blamedBranch.interType[blamedBranch.branchIndex].kind()
       === Type.TypeKind.HybridType) {
      route = <Immutable.List<BlameContext>> routeInfo.route.concat(extraRoute);
    }
    // Add any routes for nested intersections to the extracted route
    return _blame(v,blamedBranch,full,route,routeInfo.polarity);
  }
}

function is_index(value: string): boolean {
  // Bitwise necessary for checking if the number is array index
  var index = Number(value) >>> 0;
  return value === index.toString() && index !== (-1 >>> 0);
}

function monitors(ty: Type.IType, c: BlameContext): boolean {
  switch (ty.kind()) {
  case Type.TypeKind.HybridType:
    return (<Type.HybridType> ty).types.some(x => monitors(x,c));
  case Type.TypeKind.UnionType:
    return (<Type.UnionType> ty).types.some(x => monitors(x,c));
  case Type.TypeKind.FunctionType:
    return c.get('kind') === BLAME_CONTEX_KIND.FUN;
  case Type.TypeKind.ForallType:
    return monitors((<Type.ForallType> ty).type, c);
  case Type.TypeKind.ArrayType:
    return (c.get('kind') === BLAME_CONTEX_KIND.PROP &&
            is_index(c.get('prop').prop));
  case Type.TypeKind.DictionaryType:
    return c.get('kind') === BLAME_CONTEX_KIND.PROP;
  case Type.TypeKind.ObjectType:
    return (c.get('kind') === BLAME_CONTEX_KIND.PROP &&
            !!(<Type.ObjectType> ty).properties[c.get('prop')]);
  case Type.TypeKind.LazyType:
  case Type.TypeKind.BoundLazyType:
    return monitors((<Type.LazyType> ty).resolve(),c);
  case Type.TypeKind.AnyType:
    return true;
  default: return false;
  }
}

function prettyPrintPolarity(pol: BLAME_POLARITY): string {
  switch(pol) {
  case BLAME_POLARITY.POSITIVE: return "+";
  case BLAME_POLARITY.NEGATIVE: return "-";
  }
}

function prettyPrintMutable(node: MutableBlameNode): string {
  switch(node.kind) {
  case SEGMENT_KIND.LABEL:
    var _lnode = <MutableBlameLabel> node;
    return _lnode.label
  case SEGMENT_KIND.BRANCH:
    var _bnode = <MutableBlameBranch> node;
    return prettyPrintMutable(node.parent) + "/INTER";
  case SEGMENT_KIND.CONTEXT:
    var _cnode = <MutableBlameContext> node;
    var result = "";
    if(_cnode.routeKind === BLAME_CONTEX_KIND.PROP) {
      if(_cnode.polarity === BLAME_POLARITY.POSITIVE) {
        result += ("GET[" + _cnode.prop + "]");
      } else {
        result += ("SET["  + _cnode.prop + "]");
      }
      
    } else if (_cnode.routeKind === BLAME_CONTEX_KIND.FUN) {
      if(_cnode.polarity === BLAME_POLARITY.POSITIVE) {
        result += "COD"
      } else {
        result += "DOM"
      }
    }
    return  prettyPrintMutable(node.parent) + "/" + result;
  }
}
