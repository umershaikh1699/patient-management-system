from django.core.management.base import BaseCommand
from django.db import transaction

from patients.models import Clinic, Patient, Clinician


DEFAULT_ADMIN_EMAIL = "admin@patienthub.local"
DEFAULT_ADMIN_PASSWORD = "Admin1234!"
DEFAULT_ADMIN_NAME = "PatientHub Admin"

NAME_POOL = [
    "Liam",
    "Noah",
    "William",
    "James",
    "Logan",
    "Benjamin",
    "Mason",
    "Elijah",
    "Oliver",
    "Jacob",
    "Lucas",
    "Michael",
    "Alexander",
    "Ethan",
    "Daniel",
    "Matthew",
    "Aiden",
    "Henry",
    "Joseph",
    "Jackson",
    "Samuel",
    "Sebastian",
    "David",
    "Carter",
    "Wyatt",
    "Jayden",
    "John",
    "Owen",
    "Dylan",
    "Luke",
    "Gabriel",
    "Anthony",
    "Isaac",
    "Grayson",
    "Jack",
    "Julian",
    "Levi",
    "Christopher",
    "Joshua",
    "Andrew",
    "Lincoln",
    "Mateo",
    "Ryan",
    "Jaxon",
    "Nathan",
    "Aaron",
    "Isaiah",
    "Thomas",
    "Charles",
]

SPECIALTIES = ["General", "Cardiology", "Dermatology", "Pediatrics", "ENT", "Neurology"]


def pick_name(idx: int) -> str:
    # Deterministic "shuffle": pick first/last from the same pool at different offsets.
    first = NAME_POOL[idx % len(NAME_POOL)]
    last = NAME_POOL[(idx * 7 + 11) % len(NAME_POOL)]
    if last == first:
        last = NAME_POOL[(idx * 7 + 12) % len(NAME_POOL)]
    return f"{first} {last}"


def normalize_email_localpart(name: str) -> str:
    return name.lower().replace(" ", ".")


def unique_email(clinic: Clinic, base_localpart: str, *, kind: str, n: int) -> str:
    # Keep emails stable and unique within a clinic.
    local = f"{base_localpart}.{kind}{n}"
    return f"{local}@patienthub.local"


class Command(BaseCommand):
    help = "Seed demo clinicians and patients (and ensure an admin clinic user exists)."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=DEFAULT_ADMIN_EMAIL)
        parser.add_argument("--password", default=DEFAULT_ADMIN_PASSWORD)
        parser.add_argument("--name", default=DEFAULT_ADMIN_NAME)
        parser.add_argument("--patients", type=int, default=12)
        parser.add_argument("--clinicians", type=int, default=6)

    @transaction.atomic
    def handle(self, *args, **options):
        email: str = options["email"]
        password: str = options["password"]
        name: str = options["name"]
        patient_count: int = options["patients"]
        clinician_count: int = options["clinicians"]

        clinic, created = Clinic.objects.get_or_create(
            email=email,
            defaults={"name": name, "is_staff": True, "is_superuser": True},
        )
        # Ensure admin flags and password are correct for local dev.
        clinic.name = name
        clinic.is_staff = True
        clinic.is_superuser = True
        clinic.set_password(password)
        clinic.save()

        if created:
            self.stdout.write(self.style.SUCCESS(f"Created admin clinic user: {email}"))
        else:
            self.stdout.write(self.style.SUCCESS(f"Updated admin clinic user: {email}"))

        # Rename any previously-created placeholder demo rows.
        demo_patients = list(
            Patient.objects.filter(clinic=clinic, email__startswith="demo.patient").order_by("id")
        )
        if demo_patients:
            for idx, p in enumerate(demo_patients, start=1):
                p.name = pick_name(idx - 1)
                p.email = unique_email(clinic, normalize_email_localpart(p.name), kind="p", n=idx)
            Patient.objects.bulk_update(demo_patients, ["name", "email"])

        demo_clinicians = list(
            Clinician.objects.filter(clinic=clinic, email__startswith="demo.clinician", is_deleted=False).order_by("id")
        )
        if demo_clinicians:
            for idx, c in enumerate(demo_clinicians, start=1):
                base_name = pick_name(idx - 1)
                c.name = f"Dr. {base_name}"
                c.specialization = SPECIALTIES[idx % len(SPECIALTIES)]
                c.email = unique_email(clinic, normalize_email_localpart(base_name), kind="c", n=idx)
            Clinician.objects.bulk_update(demo_clinicians, ["name", "specialization", "email"])

        # Clinicians
        existing_clinicians = Clinician.objects.filter(clinic=clinic, is_deleted=False).count()
        to_create_clinicians = max(0, clinician_count - existing_clinicians)
        if to_create_clinicians:
            base = existing_clinicians
            clinicians = []
            for i in range(to_create_clinicians):
                n = base + i + 1
                clinicians.append(
                    Clinician(
                        clinic=clinic,
                        name=f"Dr. {pick_name(n - 1)}",
                        specialization=SPECIALTIES[n % len(SPECIALTIES)],
                        email=f"demo.clinician{n}@patienthub.local",
                        is_deleted=False,
                    )
                )
            Clinician.objects.bulk_create(clinicians)
        self.stdout.write(self.style.SUCCESS(f"Clinicians (active): {Clinician.objects.filter(clinic=clinic, is_deleted=False).count()}"))

        # Patients
        existing_patients = Patient.objects.filter(clinic=clinic).count()
        to_create_patients = max(0, patient_count - existing_patients)
        if to_create_patients:
            base = existing_patients
            genders = ["F", "M", "O"]
            patients = []
            for i in range(to_create_patients):
                n = base + i + 1
                patients.append(
                    Patient(
                        clinic=clinic,
                        name=pick_name(n - 1),
                        gender=genders[n % 3],
                        email=f"demo.patient{n}@patienthub.local",
                    )
                )
            Patient.objects.bulk_create(patients)
        self.stdout.write(self.style.SUCCESS(f"Patients: {Patient.objects.filter(clinic=clinic).count()}"))
