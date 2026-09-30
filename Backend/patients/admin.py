from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Clinic, Clinician, Patient, Appointment, AppointmentClinician


# Admin registration for the custom Clinic user model (email login).
@admin.register(Clinic)
class ClinicAdmin(UserAdmin):
    ordering = ['email']
    list_display = ['email', 'name', 'is_staff', 'is_active']
    search_fields = ['email', 'name']
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Info', {'fields': ('name',)}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'name', 'password1', 'password2')}),
    )
    filter_horizontal = ('groups', 'user_permissions')


@admin.register(Clinician)
class ClinicianAdmin(admin.ModelAdmin):
    list_display = ['name', 'clinic', 'specialization', 'email']
    search_fields = ['name', 'email']
    list_filter = ['clinic']


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ['name', 'clinic', 'gender', 'email', 'created_at']
    search_fields = ['name', 'email']
    list_filter = ['clinic', 'gender']


class AppointmentClinicianInline(admin.TabularInline):
    # Inline bridge rows so clinicians can be assigned within an appointment record.
    model = AppointmentClinician
    extra = 1


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ['patient', 'scheduled_at', 'duration_minutes', 'status']
    list_filter = ['status', 'scheduled_at']
    inlines = [AppointmentClinicianInline]
