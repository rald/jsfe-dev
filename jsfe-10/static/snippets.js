const SNIPPETS = {
  basics: `; Lexical scoping with 'let', global assignment '=', and functions 'fn'
(do
  (let x 10)
  (let y 25)
  (= add-offset (fn (n) (+ n x y)))
  (print "10 + 25 + 7 =" (add-offset 7))
  (add-offset 100))`,

  recursion: `; Recursive factorial and Fibonacci sequence
(do
  (= fact (fn (n)
    (if (<= n 1) 1
        (* n (fact (- n 1))))))

  (= fib (fn (n)
    (if (< n 2) n
        (+ (fib (- n 1)) (fib (- n 2))))))

  (print "5! =" (fact 5))
  (print "fib(10) =" (fib 10))
  (list (fact 6) (fib 10)))`,

  macros: `; Macros transform AST expressions before evaluation
(do
  (= defn (mac (name params . body)
    (list '= name (cons 'fn (cons params body)))))

  (= when (mac (cond . body)
    (list 'if cond (cons 'do body))))

  (defn greet (who)
    (when who
      (print "Hello," who)
      who))

  (greet "fe Lisp!"))`,

  lists: `; Functional list processing: map, filter, and reduce
(do
  (= map (fn (f xs)
    (if xs (cons (f (car xs)) (map f (cdr xs))))))

  (= filter (fn (pred xs)
    (if (not xs) nil
        (pred (car xs)) (cons (car xs) (filter pred (cdr xs)))
        (filter pred (cdr xs)))))

  (= reduce (fn (f acc xs)
    (if (not xs) acc
        (reduce f (f acc (car xs)) (cdr xs)))))

  (let nums (list 1 2 3 4 5 6))
  (let evens (filter (fn (n) (is 0 (- n (* 2 (/ n 2))))) nums))
  (let squares (map (fn (n) (* n n)) evens))
  (print "Even squares:" squares)
  (reduce + 0 squares))`,

  closures: `; Stateful closures capturing mutable lexical bindings
(do
  (= make-counter (fn (start)
    (let count start)
    (fn ()
      (= count (+ count 1))
      count)))

  (= c1 (make-counter 0))
  (= c2 (make-counter 100))
  (list (c1) (c1) (c2) (c1) (c2)))`,

  interop: `; Calling JavaScript functions registered in extend.js!
(do
  (print "PI =" PI)
  (print "sin(PI/2) =" (sin (/ PI 2)))
  (print "sqrt(144) =" (sqrt 144))
  (let upper (str/upper "hello from fe lisp"))
  (dom/toast (str/concat "Fe says: " upper))
  (list upper (str/split "a,b,c" ",")))`
};
