module BABYLON {
    
    var canvas = <HTMLCanvasElement>document.getElementById("renderCanvas"); // Get the canvas element 
    var engine = new Engine(canvas, true); // Generate the BABYLON 3D engine
    var scene = new Scene(engine);

    /**
     * 第一步就是调用Scene的render函数。
     */
    Scene.prototype.render();
    /**
     * 之后是对于些私有属性：_activeParticles、_totalVertices、_activeIndices、_activeBones
     * 的fetchNewFrame调用，这些属性都是PerfCounter的实例。
     * PerfCounter的是一种监视器，户主要负责两种监视类型：事件和数量，
     * 在这里，这些属性所监视的都是数量，所以每次开始新的计数前需要调用fetchNewFrame开始新的帧监视，
     * 而在之后的更新中调用addCount(newCount: number, fetchResult: boolean)
     * 当addCount的fetchResult为true时，表示这次的计数结束，PerfCounter会更新一些类似于平均值之类的信息。
     */
    PerfCounter.prototype.fetchNewFrame();
    /**
     * _meshesForIntersections.reset()
     * _meshesForIntersections的类型是SmartArrayNoDuplicate
     * reset方法继承于模板类SmartArray<AbstractMesh>
     * SmartArray是一个类似于C++ Vector的数据结构，其除了有Array的常用方法外，
     * 内部最主要的特性就是当容器内的元素超过设定值的时候，会将容器的上限调整为当前值的2倍，
     * 这样的设计本人猜测是因为设定固定长度的数组对于JS的执行速率有提升？
     * 但是，无论如何这些内部实现都是对外屏蔽的，座椅并不需要太多的关心。
     * SmartArrayNoDuplicate顾名思义就是没有重复元素的数组，值得注意的是:
     * SmartArrayNoDuplicate所存储的类型必须不是是对象，
     * 因为，其内部会对于已存在与某个SmartArrayNoDuplicate的对象设定一个Map来记录
     * 哪些SmartArrayNoDuplicate存储了它，所以在调用pushNoDuplicate方法的时候就能很快地判断这个元素是否在当前的
     * SmartArrayNoDuplicate实例中了，当然这是一个空间换时间的算法，
     * push查重：O(n) => O(1)
     * 对象空间：O(1) => >O(1) 取决于存储了该对象的SmartArrayNoDuplicate实例个数
     * reset就是更新内部id，然后将length设为0（避免数组清空导致的结构变化）.
     */
    new SmartArrayNoDuplicate<AbstractMesh>(256).reset();
    /**
     * 这个方法涉及3个属性：_cachedMaterial、_cachedEffect、_cachedVisibility
     * 类型分别为Nullable<Material>、Nullable<Effect>、Nullable<number>
     * 具体这些事干什么的先不讲，但是从名字可以看出来这是用来比较的缓存值，
     * 在将来判断的时候就会通过是否相等来区分处理已缓存的情况和未缓存的情况，
     * 这里有个小的JS技巧，就是将null赋值给number类型，其实不只是number类型，null !== null是恒成立的，
     * 这个特性对于初始化缓存值相当有用，这会使得缓存在被设定为null之后必定会触发未缓存的情况的逻辑。
     * Three.js中也有这样使用null的情况。
     * resetCachedMaterial就是将这3个属性设置为null。
     */
    Scene.prototype.resetCachedMaterial();

    /**
     * onBeforeAnimationsObservable
     * 这个Observable和Observer的代码有点多，但是实现的内容并不复杂，
     * 简单的理解就是一个hook，用于实现与事件分发的功能，
     * 使用add方法添加回调，具体还有mask等内部设置，以及事件阻止等功能。
     */
    new Observable<Scene>().notifyObservers(scene);
    
    /**
     * ActionManager实例actionManager
     * ActionManager是什么？这个设计到Action
     * Action是BABYLON中用于处理交互的对象，举个例子：用户点击场景中的某个盒子，
     * 使用Action功能就必须使用ActionManager将场景和物体联系起来：
     * mesh.actionManager = new BABYLON.ActionManager(scene);
     * 除了Mesh有ActionManager，Scene也有ActionManager，事实上Scene还有一个_actionManagers属性，
     * 它表示哪些ActionManager与该Scene建立了关系。
     * 我才这里已经搞不清楚这些东西是什么了吧？
     * 所以，之前的当做一个铺垫，重要的是你已经有了两个概念：
     * 1. Mesh和Scene都有actionManager属性。
     * 2. actionManager是关联Action，Mesh和Scene的重要桥梁。
     * 
     * 为了能够清楚地理解和使用Action系统，必须从头开始理清关系。
     * 首先先介绍一下Condition类，这个类的实现和派生类很多，功能也比较不太容易理解，
     * 但是概括其主要功能的话：一个带有actionManager属性的比较器，比较器也可以理解为断言器，
     * 处理一些比如大于小于等于的判断，主要被调用的方法为isValid
     * 主要的类有：
     * Condition：什么都不做，isValid() === true 作为基类
     * ValueCondition：用于设定一个对象的属性和设定值的关系，最简单的描述就是：
     *      isValid : return target.property operation value
     *      所以其构造函数除了actionManager之外还有target、property、operation和value
     * PredicateCondition：这个就是自己指定一个函数的断言器
     *      isValid : return predicate()
     *      所以其构造函数除了actionManager之外还有predicate
     * StateCondition：可以理解为property === ‘state’的特化ValueCondition
     * 另外提一句ValueCondition、PredicateCondition、StateCondition都可以被序列化。
     * 说了主体，再说细节。Condition有_evaluationId、_currentResult两个属性，从名字上就知道，
     * 这是为了缓存执行判断后的值而存在的，在Action中会对这两个值进行操作，从而使用缓存值来避免多余的计算。
     * 
     * Condition其实只是一个Action的可选项，但是会被经常使用，在Condition被介绍之后就基本能够无障碍地解释Action了，
     * 一个Action实际上就是一个循环链表，虽然很难看出来，每一个action都是执行循环链表中的某一个节点的状态，
     * （所以一个Action被使用完成一套之后想不被循环就必须移除自身，相关函数unregisterAction）
     * _nextActiveAction表示表头，_child表示next
     * 在调用Action.prototype._executeCurrent时，会判断是否有_condition，如果有_condition且为true，或者无_condition
     * 那么会执行后续的Action，否则终止。（在具体的实现中可以发现Action中Condition是根据Scene的renderID来缓存的。）
     * Action是个链表其追加元素的方式就是then多次调用then会覆盖之前的值，所以不能重复调用，
     * 如果确实需要处理多个后续的Action可以使用CombineAction（之后再讲吧）。
     * Action还有一个重要的参数trigger，用于表示触发类型，这个先不讲买个伏笔，简单讲就是什么时候该出发这个Action。
     * 
     * 事实上Action的直接应用并不多，这是因为：
     * 1. Action作为基类_prepare和execute是空函数
     * 2. BABYLON提供了丰富的Action的派生类，
     * Action派生类主要可以分为两类，体现在文件中，babylon.directActions.ts和babylon.interpolateValueAction.ts
     * directActions主要指即时执行的Action；
     * interpolateValueAction是应用插值产生的过程Action，其实现依赖于Animation（后面再细讲）。
     * directActions有：
     * SwitchBooleanAction：实现看起来很复杂，实际上就是把某个对象的某个属性（布尔值）取反，例子最直接
     *      target = t, propertyPath = "fisrt.second" => 内部会在_prepare中存储为 effectTarget = t.first, property = "second"
     *      不错，就是一个基于字符串的多级属性解析器
     *      执行的语句：effectTarget[property] = !effectTarget[property]
     * SetStateAction：target = t, property = "state" value = v 的特化的SwitchBooleanAction
     *      执行的语句：target.state = value
     * SetValueAction：SwitchBooleanAction 和 SetStateAction的结合体
     *      执行的语句：effectTarget[property] = value
     *      细节：拥有markAsDirty方法的target会调用markAsDirty(property)方法（比如Material）
     * IncrementValueAction：类似SetValueAction
     *      执行的语句：effectTarget[property] += value
     * PlayAnimationAction、StopAnimationAction
     *      执行的语句：  scene.beginAnimation(target, from, to, loop);
     *                  scene.stopAnimation(target, from, to, loop);
     *      说明：之后再讲动画吧
     * DoNothingAction：
     *      什么都不做，空节点
     * CombineAction：
     *      执行一串Action，CombineAction其实像是一个树的root
     * ExecuteCodeAction：
     *      执行函数
     * SetParentAction：
     *      这个比较特殊
     *      执行的语句：if (this._target.parent === this._parent) {
                return;
            } else {
                //更新target的矩阵
            }
     *      说明：可以推测出来，这各Action是针对具有坐标的对象，比如Node
     * PlaySoundAction、StopSoundAction：
     *      播放、暂停音频
     * 
     * interpolateValueAction涉及许多动画的东西，这里只需要知道它能够对一些数据类型，
     * 比如：颜色、向量、数字、矩阵进行插值动画
     * 细节是：interpolateValueAction只能支持100帧的动画，而且无法更改这个数字，
     * 你只能通过更改帧率（帧/秒）来操纵动画的执行事件，所以当然当帧率很低的时候就变成幻灯片了……
     * 构造函数的stopOtherAnimations参数设为true还可以使得该事件被触发时停止其他的在指定物体上的动画Action
     * 
     * 讲了很多脱离渲染循环主体的东西，捋一下，
     * 我们介绍Action是因为ActionManager管理着Action（这个之前没讲）
     * 而 Mesh => ActionManager <= Scene，所以Scene中所有物体的Action都会涉及到Action的知识。
     * Action本身也和物体挂钩，从构造函数就可以看出来。
     * 但是这个物体是执行Action的对象，并不是触发Action的对象，触发Action的对象是Mesh（和Scene）。
     * 参照script/actions.js的demo可以知道一个盒子触发的Pick事件最终会引起光线的颜色变化。
     * 
     * 在对于Action的相关东西有比较全面的了解之后，还有两个问题：
     * 1、如何触发Action
     * 2、为什么ActionManager要Scene的介入
     * 
     * 第一个问题：触发Action的顺序为：_prepare(), execute()。但是通常基本不会这样直接暴力地使用（如果你熟悉源码的话随便）
     * Action的触发一般是通过ActionManager的processTrigger来实现的，还记得Action的trigger属性吗？
     * processTrigger会触发指定类型的Action
     * 那么有哪些类型呢？
     * ActionManager提供了这么多
     *  private static _NothingTrigger = 0;
        private static _OnPickTrigger = 1;
        private static _OnLeftPickTrigger = 2;
        private static _OnRightPickTrigger = 3;
        private static _OnCenterPickTrigger = 4;
        private static _OnPickDownTrigger = 5;
        private static _OnDoublePickTrigger = 6;
        private static _OnPickUpTrigger = 7;
        private static _OnLongPressTrigger = 8;
        private static _OnPointerOverTrigger = 9;
        private static _OnPointerOutTrigger = 10;
        private static _OnEveryFrameTrigger = 11;
        private static _OnIntersectionEnterTrigger = 12;
        private static _OnIntersectionExitTrigger = 13;
        private static _OnKeyDownTrigger = 14;
        private static _OnKeyUpTrigger = 15;
        private static _OnPickOutTrigger = 16;
     *
     * 所以实际上你还可以扩充自己的类型只要不和这些冲突即可（好吧，这个也需要你了解源码）
     * 第一个问题算回答了一半，先来回答第二个问题。
     * 很显然第二个问题的根本原因在于ActionManager并没有和Scene解耦，比如OnPickUpTrigger类型的Action
     * 跟踪可以发现
     * Scene.prototype.attachControl()
     *      _onPointerUp()
     *          _initClickEvent()
     *              _processPointerUp()
     *                  mesh.actionManagerprocessTrigger(ActionManager.OnPickTrigger, ...)
     * 和用户输入相关的这些常用的拾取事件都需要scene._engine.getRenderingCanvas()来获取canvas，
     * 所以第二原因就是BABYLON就是这么设计的，其中它还处理了一些事件比如move和wheel，这些Action都不需要用户手动调用processTrigger去触发。
     * 这样做的好处是大于弊处的，因为大大方便了用户完成交互的开发工作，因为绝大部分用不到其他的Action，
     * 只要提供最常用的一些就可以了。
     * 前面说第一个问题回答了一半的原因是因为没有介绍完整，比如如何向ActionManager注册Action：
     * actionManager.registerAction(action)就可以了。
     * 还有一个疑点NothingTrigger什么时候触发？实际上不会被触发，但是如果它不是表头就又是另外一回事了。
     * 这么说有点绕，通俗的将，就是一个Action的循环链表，其中的触发条件只跟表头的trigger有关，
     * 后面随便then怎么样类型的Action都没影响，举个scripts/actions.js的例子：
     * 
     * var goToColorAction = new BABYLON.InterpolateValueAction(BABYLON.ActionManager.OnPickTrigger, light, "diffuse", color, 1000, null, true);

        mesh.actionManager = new BABYLON.ActionManager(scene);
        mesh.actionManager.registerAction(
            new BABYLON.InterpolateValueAction(BABYLON.ActionManager.OnPickTrigger, light, "diffuse", BABYLON.Color3.Black(), 1000))
            .then(new BABYLON.CombineAction(BABYLON.ActionManager.NothingTrigger, [ // Then is used to add a child action used alternatively with the root action. 
                goToColorAction,                                                 // First click: root action. Second click: child action. Third click: going back to root action and so on...   
                new BABYLON.SetValueAction(BABYLON.ActionManager.NothingTrigger, mesh.material, "wireframe", false)
            ]));
     * 
     * 我相信大部分人只看这个actions的demo基本上是云里雾里的。
     * 那么就这一片段我来详细讲讲，首先
     * new BABYLON.InterpolateValueAction(BABYLON.ActionManager.OnPickTrigger, light, "diffuse", BABYLON.Color3.Black(), 1000))
            .then(new BABYLON.CombineAction(BABYLON.ActionManager.NothingTrigger, [ // Then is used to add a child action used alternatively with the root action. 
                goToColorAction,                                                 // First click: root action. Second click: child action. Third click: going back to root action and so on...   
                new BABYLON.SetValueAction(BABYLON.ActionManager.NothingTrigger, mesh.material, "wireframe", false)
            ])
     * 这一部分中的主体是light的InterpolateValueAction，它是整个循环链表的头，所以无论后面如何，这个action链表的触发条件只能是点击事件。
     * 所以后面用一个CombineAction来同时完成goToColorAction和SetValueAction两个Action的触发条件也是OnPickTrigger，
     * 根NothingTrigger无关，同理goToColorAction中的OnPickTrigger也是无关紧要的，将它换成NothingTrigger是没有任何影响的。
     * 是不是很诡异？就是这样的，造成这一原因的是processTrigger的实现中直接将action.trigger来和系统中的trigger来比较了，
     * action.trigger早早就被light的InterpolateValueAction订好了，就没有其他后续Action的事了。
     * 关于Action的最后一个注解是OnEveryFrameTrigger的trigger只能在Scene的actionManager触发，
     * 不要问我为什么，BABYLON内部就是这么判断的，不然会报错。
     * 至此，关于Action相关的整体架构和功能就基本解释的七七八八了，理解这些之后用Action基本是没有问题了吧？
     * 其他的细节还有很多，就不细抠了（细抠又是一大段，比如canvas的各种事件处理，BABYLON是如何自己实现双击判断的，毕竟游戏中的双击和DOM的双击延迟要求可能不一样，等等）。
     * 下面这句没有疑问了吧？其实就是触发Action，只不过scene.actionManager默认没有加Action，
     * 如果你想在Scene被渲染的每一帧做点事情的话就用它吧！
     */
    if (scene.actionManager) {
        scene.actionManager.processTrigger(ActionManager.OnEveryFrameTrigger);
    }
    /**
     * http://doc.babylonjs.com/how_to/in-browser_mesh_simplification
     */
    if (scene.simplificationQueue && !scene.simplificationQueue.running) {
        scene.simplificationQueue.executeNext();
    }

    /**
     * 这里终于要讲一些关于引擎的东西了
     */
    if (this._engine.isDeterministicLockStep()) {
        var deltaTime = Math.max(Scene.MinDeltaTime, Math.min(this._engine.getDeltaTime(), Scene.MaxDeltaTime)) + this._timeAccumulator;

        var defaultFPS = (60.0 / 1000.0);

        let defaultFrameTime = 1000 / 60; // frame time in MS

        if (this._physicsEngine) {
            defaultFrameTime = this._physicsEngine.getTimeStep() * 1000;
        }
        let stepsTaken = 0;

        var maxSubSteps = this._engine.getLockstepMaxSteps();

        var internalSteps = Math.floor(deltaTime / (1000 * defaultFPS));
        internalSteps = Math.min(internalSteps, maxSubSteps);

        do {
            this.onBeforeStepObservable.notifyObservers(this);

            // Animations
            this._animationRatio = defaultFrameTime * defaultFPS;
            this._animate();
            this.onAfterAnimationsObservable.notifyObservers(this);

            // Physics
            if (this._physicsEngine) {
                this.onBeforePhysicsObservable.notifyObservers(this);
                this._physicsEngine._step(defaultFrameTime / 1000);
                this.onAfterPhysicsObservable.notifyObservers(this);
            }

            this.onAfterStepObservable.notifyObservers(this);
            this._currentStepId++;

            stepsTaken++;
            deltaTime -= defaultFrameTime;

        } while (deltaTime > 0 && stepsTaken < internalSteps);

        this._timeAccumulator = deltaTime < 0 ? 0 : deltaTime;

    }
    
}