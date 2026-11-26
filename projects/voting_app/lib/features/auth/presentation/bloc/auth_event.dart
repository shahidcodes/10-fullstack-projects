import 'package:equatable/equatable.dart';

abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

// Check whether a user is already authenticated.
class AuthCheckRequested extends AuthEvent {
  const AuthCheckRequested();
}

// Register a new user.
class AuthRegisterRequested extends AuthEvent {
  final String name;
  final String email;
  final String password;

  const AuthRegisterRequested({
    required this.name,
    required this.email,
    required this.password,
  });

  @override
  List<Object?> get props => [name, email, password];
}

// Login an existing user.
class AuthLoginRequested extends AuthEvent {
  final String email;
  final String password;

  const AuthLoginRequested({required this.email, required this.password});

  @override
  List<Object?> get props => [email, password];
}

// Refresh the token pair.
class AuthRefreshRequested extends AuthEvent {
  const AuthRefreshRequested();
}

// Logout the current user.
class AuthLogoutRequested extends AuthEvent {
  const AuthLogoutRequested();
}
