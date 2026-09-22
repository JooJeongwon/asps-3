# Supabase DB Schema

## department

| Column Name     | Type   | Constraint |
| --------------- | ------ | ---------- |
| department_id   | SERIAL | PK         |
| department_name | TEXT   | UK         |
| founded_date    | DATE   | NOT NULL   |
| office_phone    | TEXT   | Nullable   |
| office_address  | TEXT   | Nullable   |
| note            | TEXT   |            |

---

## student

| Column Name   | Type   | Constraint                       |
| ------------- | ------ | -------------------------------- |
| student_id    | SERIAL | PK                               |
| name          | TEXT   | NOT NULL                         |
| birth_date    | DATE   | NOT NULL                         |
| phone         | TEXT   | UK                               |
| email         | TEXT   | UK                               |
| department_id | INT    | FK → department(department_id)   |
| note          | TEXT   |                                  |
---

## course

| Column Name | Type   | Constraint |
| ----------- | ------ | ---------- |
| course_id   | SERIAL | PK         |
| course_name | TEXT   | NOT NULL   |
| note        | TEXT   |            |

---

## enrollment

| Column Name | Type        | Constraint                       |
| ----------- | ----------- | -------------------------------- |
| enrollment_id | SERIAL    | PK                               |
| student_id  | INT         | FK → student(student_id)         |
| course_id   | INT         | FK → course(course_id)           |
| gpa         | NUMERIC(4,2)| Nullable                         |
| note        | TEXT        |                                  |